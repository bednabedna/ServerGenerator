module.exports = generateRoutes;

const path = require("path");

const optGen = require("./optionsGenerator");
const utils = require("./utils");
const {generateDbQueryCode,	generateQueryFragmentsVar} = require("./dbQuery");
const {generateCheckCode, emailRegexConstCode} = require("./check");
const checkRequestVariables = require("./checkRequestVariables");
//const generateApi = require("./apiGenerator");
const {generatePreErrorHandlerCode, generateErrorHandlerCode} = require("./onError");

async function generateRoutes(xmlConfigs, outputpath) {
	// generate api script
	//generateApi(routesXml, beautify, resolvePath);

	// generate router script
	let routesXml = xmlConfigs.get("/app/routes");

	let routes = routesXml.find("./route | ./router");

	let result = 'const router = require("express").Router();\n';

	if(routesXml.get(".//login | .//logout | .//authenticate"))
		result += 'const authentication = require("../../libs/authentication");\n';

	if(routesXml.get(".//dbQuery"))
		result += 'const db = require("../../libs/db");\n';

	if(routesXml.get(".//email[not(ancestor::check | ancestor::view)]")) {
		if(!routesXml.get("/app/emails"))
			throw "cannot send email without mailer configuration";
		result += 'const emails = require("../../libs/emails");\n';
	}

	result += emailRegexConstCode(routesXml);

	if(routesXml.get(".//encrypt"))
		result += generateEncryptFunctionDeclarationCode();

	if(routesXml.get(".//options")) {
		result += optGen.optionsDeclaration();
		if(routesXml.get(".//string/options"))
			result += optGen.optionsInStringDeclaration();
		if(routesXml.get(".//dbQuery/options"))
			result += optGen.optionsInDbQueryDeclaration();
	}

	result += "\nmodule.exports = router;\n\n";

	for(let route of routes)
		if(route.name() === "route")
			result += generateRouteCode(route, "/");
		else
			result += generateRouterCode(route, "/");

	return result;
}

function generateRouterCode(router, urlPrefix) {
	console.assert(router.name() === "router", "generateRouteCode must receive a route node");

	let url = router.attr("url").value();

	console.assert(url[0] === "/", "router url must start with /");

	urlPrefix = path.join(urlPrefix, url);

	let result = "";

	for(let child of router.childNodes()) {
		let childName = child.name();
		if(childName === "route")
			result += generateRouteCode(child, urlPrefix);
		else if(childName === "router")
			result += generateRouterCode(child, urlPrefix);
	}

	return result;
}

const componentHandler = {
	  check: 		x => generateCheckCode(x) + "\n",
	  dbQuery: 		x => generateDbQueryCode(x) + "; \n",
	  send: 		x => generateSendCode(x),
	  view: 		x => generateViewCode(x),
	  status: 		x => generateStatusCode(x),							
	  redirect: 	x => generateRedirectCode(x),
	  email: 		x => generateEmailCode(x),
	  log: 			x => generateLogCode(x),
	  login: 		x => generateLoginCode(x) + ";\n",
	  authenticate: x => generateAuthenticateCode(x) + ";\n",
	  return: 		x => "return;\n",
	  onError: 		x => generateErrorHandlerCode(x, recursion),
	  logout:       x => generateLogoutCode(x) + ";\n",
};

function recursion(node) {
	let callbackBody = "";  
	for(let component of node.childNodes())
		if(component.type() === "element") {
			let handler = componentHandler[component.name()];
			console.assert(handler, component.name() + " is not a valid component");
			callbackBody += handler(component);
		}
	return callbackBody;
}

function generateRouteCode(route, urlPrefix) {
	console.assert(route.name() === "route", "generateRouteCode must receive a route node");
	console.assert(route.get("string(./@type)") === "post" || !Boolean(route.get("./descendant::body")), "route of type " + route.get("./@type").value() + " cannot have body\n\n" + route.toString());

	let callbackBody = "";

	callbackBody += generatePreErrorHandlerCode(route);
	callbackBody += generatePermissionsCode(route);
	callbackBody += checkRequestVariables(route);
	callbackBody += optGen.generatePreOptionsCode(route);

	for(let dbQuery of route.find(".//dbQuery"))
		callbackBody += generateQueryFragmentsVar(dbQuery);

	callbackBody += recursion(route);

	if(!callbackBody)
		return "";

	let callback = "";

	const isAsync = route.find(".//dbQuery | .//authenticate  | .//login | .//logout | .//email[not(ancestor::check | ancestor::view)]").filter(utils.generateAwaitCode).length > 0;

	if(isAsync)
		callback += "async ";

	callback += `function(request, response, next) {
		try {
			${callbackBody}
		} catch(error) {
			console.error(error);
			response.${route.get(".//view") ? "redirect('/')" : "status(400).send(error)"};
		}
	}`;

	let url = path.join(urlPrefix, route.get("string(./@url)")).replace(/\\/g, "/");

	return `router${utils.asAccessor(route.get("string(./@type)"))}(${JSON.stringify(url)}, ${callback});\n\n`;
}

function generateLogCode(log) {
	return "console.log(" + utils.generateTemplatedString(log) + ");";
}

function generatePermissionsCode(route) {
	let allowedRolesString = route.get("string(./@allow)").trim();
	if(!allowedRolesString) return "";
	let allowedRolesAndGuest = allowedRolesString.split(",").map(role => role.trim());
	console.assert(new Set(allowedRolesAndGuest).size === allowedRolesAndGuest.length, "some role are repeated");
	allowedRoles = allowedRolesAndGuest.filter(role => role !== "guest");

	let noGuest = allowedRolesAndGuest.length === allowedRoles.length;
	let hasStar = allowedRoles.some(r => r === "*");
	
	console.assert(!hasStar || allowedRoles.length === 1 || (allowedRoles.length === 2 && !noGuest), "* is redundant with any role outside of guest");

	let check1, op, check2;

	if(noGuest) {
		check1 = "!request.user";
		op = " || ";
	} else {
		check1 = "request.user";
		op = " && ";
	}

	if(hasStar || allowedRoles.length === 0)
		check2 = op = "";
	else if(allowedRoles.length === 1)
		check2 = "request.user.role !== " + JSON.stringify(allowedRoles[0]);
	else
		check2 = JSON.stringify(allowedRoles) + ".every(role => role !== request.user.role)";
	
	return "if(" + check1 + op + check2 + `)\nreturn response.${route.get(".//view") ? "redirect('/')" : "status(401).send('Unauthorized')"};\n\n`;
}

function generateStatusCode(status) {
	console.assert(status.name() === "status", "generateStatusCode must receive a status node");
	return "response.status(" + status.text() + ");\n";
}

function generateSendCode(send) {
	console.assert(send.name() === "send", "generateSendCode must receive a send node");
	let result = "response";
	
	let status = send.get("string(./@status)");

	if(status)
		result += `.status(${status})`;

	return result + `.send(${utils.generateData(send)});\n`;
}

function generateRedirectCode(redirect) {
	return `response.redirect(${utils.generateTemplatedString(redirect)});\n`;
}

function generateViewCode(view) {
	console.assert(view.name() === "view", "view node must be of type view");
	let viewName = JSON.stringify(view.attr("name").value());
	let dataLoaderCode = utils.generateDataLoader(view);
	if(dataLoaderCode)
		return `response.render(${viewName}, ${dataLoaderCode});\n`;
	return `response.render(${viewName});\n`;
}

function generateEmailCode(email) {
	console.assert(email.name() === "email", "email node must be of type email");
	let emailName = JSON.stringify(email.attr("name").value());
	let to = utils.generateTemplatedString(email.get("./to"));
	let subject = utils.generateTemplatedString(email.get("./subject"));
	let dataLoaderCode = utils.generateDataLoader(email.get("./data"));
	if(dataLoaderCode)
		return `${utils.generateAwaitCode(email)}emails.send(${emailName}, ${to}, ${subject}, ${dataLoaderCode});\n`;
	return `${utils.generateAwaitCode(email)}emails.send(${emailName}, ${to}, ${subject});\n`;
}

function generateEncryptFunctionDeclarationCode() {
	return `const bcrypt = require("bcrypt");
	/**
	 * Encript string
	 */
	function encrypt(string) {
		return new Promise((resolve, reject) => {
			bcrypt.genSalt(10, (err, salt) => {
				if (err)
					return reject(err);
				bcrypt.hash(string, salt, (err, hash) => {
					if (err)
						return reject(err);
					resolve(hash);
				});
			});
		});
	}
	`;
}

function generateLoginCode(login) {
	return `${utils.generateAwaitCode(login)}authentication.loginAsync(request, ${utils.generateDataLoader(login)})`;
}

function generateLogoutCode(logout) {
	return `${utils.generateAwaitCode(logout)}request.logout()`;
}

function generateAuthenticateCode(auth) {
	let children = auth.childNodes().filter(c => c.type() === "element");
	console.assert(children.length === 2, "authenticate should have 2 children");
	let username = children[0];
	let password = children[1];
	if(username.name() !== "username" || password.name() !== "password") {
		console.assert(username.name() === "password" && password.name() === "username", "authenticate children must be username and password");
		let t = username;
		username = password;
		password = t;
	}
	username = utils.generateData(username);
	password = utils.generateData(password);
	return `${utils.generateAwaitCode(auth)} authentication.authenticateAsync(${username}, ${password}, request)`;
}



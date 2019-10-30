module.exports = generateApi;

const fs = require("fs-extra");
const {asObjectKey} = require("./utils");
const path = require("path");

function generateApi(routesXml, beautify, resolvePath) {
	let apiFolder = routesXml.attr("apiFolder");
	
	if(!apiFolder)
		return;

	apiFolder = resolvePath(apiFolder.value());

	try { fs.ensureDir(apiFolder); } catch(_) {}

	let code = generateApiCode(routesXml);

	if(beautify) {
		code = require("js-beautify").js(code);
	}

	let apiPath = path.join(apiFolder, "api.js");

	fs.writeFile(apiPath, code).catch(console.error);
}

function normalizeRoutes(routesXml) {
	let routes = [];
	for(let child of routesXml.childNodes()) {
		if(child.type() !== "element")
			continue;
		console.assert(child.name() === "route", "must receive route");
		let type = child.attr("type").value();
		let url = child.attr("url").value();
		let urlStack = url.split("/").filter(x => x).reverse();
		routes.push({type, url, urlStack});
	}
	// [{type: "get" | "post", route: "/the/route/path", routeStack: ["path", "route", "the"], logic: {type: "logic"}}]
	return routes;
}

function aggregateRoutes(routes) {
	let apiObject = {};
	// add methods implementation or push routes to be
	// processed in a deeper level of the apiObject
	for(let route of routes) {
		let segment = route.urlStack.pop();
		if(!segment) {
			// add implementation
			console.assert(!apiObject[route.type], "route already exists.");
			apiObject[route.type] = route.logic;
		} else {
			// push route deeeper in apiObject
			if(!apiObject[segment])
				apiObject[segment] = [];
			apiObject[segment].push(route);
		}
	}
	// resolve deeeper routes
	for(let segment in apiObject)
		if(Array.isArray(apiObject[segment]))
			apiObject[segment] = aggregateRoutes(apiObject[segment]);
    // return apiObject where each value is an apiObject or a string
    // with the code for the api call 
	return apiObject;
}

function generateCodeForApiObject(apiObject) {
	return `{\n${
		Object.entries(apiObject)
		.map(e => {
			let key = asObjectKey(e[0]);
			let value = typeof e[1].type === "logic" ? e[1] : generateCodeForApiObject(e[1]);
			return key + ": " + value;
		})
		.join(",\n")
	}\n}`;
}

function generateApiCode(routesXml) {
	let routes = normalizeRoutes(routesXml);
	let apiObject = aggregateRoutes(routes);
	let validationApiCode = generateCodeForApiObject(apiObject);
	let queryApiCode = generateCodeForApiObject(apiObject);
	return `const Api = {\nvalidation: ${validationApiCode},\n\query: ${queryApiCode}\n};\n\n`;
}
module.exports = {
	asObjectKey,
	asAccessor,
	generateRequestVariable,
	generateValue,
	generateTemplatedString,
	asJsVarName,
	generateAwaitCode,
	getVariableFor,
	normalizeSpacing,
	generateData,
	generateDataLoader
};

const optionsGen = require("./optionsGenerator");
const {generateDbQueryCode} = require("./dbQuery");

const VALID_JS_VAR_NAME_REGEX = /^[\w$]+$/;
const ILLEGAL_TEMPLATE_CHARS_REGEX = /[`$\\}]/;

// valid object key (uses "" if invalid variable name)
function asObjectKey(strName) {
	if(strName.match(VALID_JS_VAR_NAME_REGEX))
		return strName;
	return JSON.stringify(strName);
}

// valid accessor, uses . if valid variable name [""] otherwise
function asAccessor(strName) {
	if(strName.match(VALID_JS_VAR_NAME_REGEX))
		return "." + strName;
	return "[" + JSON.stringify(strName) + "]";
}

const variablesPrefixMap = {
	"body": "request.body",
	"param": "request.params",
	"query": "request.query",
	"request": "request",
	"user": "request.user"
};

function getVariableFor(alias) {
	return variablesPrefixMap[alias];
}
// <body>ciao." mar snd -". asdkas</body> => request.body.ciao["\"mar snd -\""][" asdkas"]
function generateRequestVariable(variable) {
	let varType = variable.name();
	let varPrefix;
	if(varType === "value") {
		throw `unsupported variable type 'value'`;
	} else {
		varPrefix = variablesPrefixMap[varType];
		if(!varPrefix)
			throw `unsupported variable type '${varType}'`;
	}
	let varPostfix = variable.text() ? variable.text().split(".").map(asAccessor).join("") : "";
	return varPrefix + varPostfix;
}

function generateValue(node) {
	if(node.type() === "text")
		return JSON.stringify(node.text());
	if(node.type() === "element") {
		if(node.name() === "dbQuery")
			return generateDbQueryCode(node);
		if(node.name() === "length")
			return generateData(node)+".length";
		if(node.name() === "not")
			return "!("+generateData(node)+")";
		if(node.name() === "json")
			return "JSON.stringify("+generateTemplatedString(node)+")";
		if(node.name() === "string")
			return generateTemplatedString(node);
		if(node.name() === "options")
			return optionsGen.optionsVariable(node);
		if(node.name() === "encrypt")
			return "await encrypt(" + generateTemplatedString(node) + ")";
		if(node.name() === "error")
			return "error.toString()";
		return generateRequestVariable(node);
	}
	throw "invalid node";
}

function generateTemplatedString(node) {
	let children = node.childNodes();

	if(children.length === 1)
		return generateValue(children[0]);

	let result = "`";
	for(let child of children)
		if(child.type() === "element") {
			result += "${" + generateValue(child) + "}";
		} else {
			let text = child.text();
			console.assert(!text.match(ILLEGAL_TEMPLATE_CHARS_REGEX), "text cannot have \\, ` or $");
			result += text;
		}
	return result + "`";
}

// come templated string solo che nodo padre non accetta mixed content
function generateData(node) {
	children = node.childNodes();

	console.assert(children.every(c => c.type() === "element" || c.text().match(/^[ \n\t]*$/)), node.name() + " cannot contain text.");
	children = children.filter(c => c.type() === "element");
	console.assert(children.length === 1, node.name() + " node must have one child");
	return generateValue(children[0]);
}

// riceve
// ritorna un oggetto con chiave nome nodo e valore data in nodo
function generateDataLoader(dataHolder) {
	if(!dataHolder)
		return "";
	let data = dataHolder.find("./*");
	if(data) {
		let expressions = [];
		for(let variable of data)
			expressions.push(asObjectKey(variable.name()) + ": " + generateData(variable));
		if(!expressions.length)
			return "";
		return "{\n" + expressions.join(",\n") + "\n}";
	}
	return "";
}


function asJsVarName(name) {
	console.assert(typeof name === "string", "name must be a string");
	name = name.replace(/[^\w]+/g, "_");

	if(parseInt(name[0]))
		name = "_" + name.substr(1);

	return name;
}


// await default true
function generateAwaitCode(awaitable) {
	let awaitAttr = awaitable.attr("await");
	return !awaitAttr || awaitAttr.value() === "true" ? "await " : "";
}

function normalizeSpacing(str) {
	return str.replace(/(\s|\\n|\\t)+/g, ' ');
}
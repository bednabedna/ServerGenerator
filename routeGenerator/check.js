module.exports = {
	generateCheckCode: checkCode,
	emailRegexConstCode
}

const utils = require("./utils");
const locale = require("../locale").getLocale();


function emailRegexConstCode(xml) {
	if(xml.get("//route//check//email"))
		return "const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;\n";
	return "";
}

function checkCode(check) {
	console.assert(check.name() === "check", "check node expected, found " + check.name());

	let code = "";

	for(let child of check.childNodes())
		if(child.type() === "element")
			code += checkValue(child);

	return code;
}

function checkValue(node) {
	switch(node.name()) {
		case "string":  return string(node);
		case "email":   return email(node);
		case "object":  return object(node);
		case "integer": return integer(node);
		case "number":  return number(node);
		default:        return defaultCheck(node);
	} 
}

function getFromFor(node) {
	let path = [];
	let currentNode = node;
	do {
		let last = currentNode.attr("name");
		path.push(last.value());
		currentNode = currentNode.parent();
	} while(currentNode.name() !== "check");
	
	let origin = path.pop();

	//let from = path.length ? path.join(locale.of()) + locale.in() + origin : origin;
	let from = path.length > 1 ? path.slice(1).join(locale.of()) : path[0] || origin;

	let fromVariable = utils.getVariableFor(origin) + path.reverse().map(e => utils.asAccessor(e)).join("");

	return {from, fromVariable};
}

function stringCheck(fromVariable, from) {
	return `if(typeof ${fromVariable} !== "string")\nthrow(${locale.expectedString(from)});\n\n`;
}

function minMaxLenCheck(fromVariable, from, node) {

	let code = "";
	
	let minAttr = node.attr("min");
	let maxAttr = node.attr("max");

	if(minAttr)
		min = parseFloat(minAttr.value());

	if(maxAttr)
		max = parseFloat(maxAttr.value());

	if(maxAttr && max < 1)
		throw "max can't be less than 1";

	if(minAttr && min < 0)
		throw "min can't be less than 1";

	if(minAttr && maxAttr && min > max)
		throw "min can't be more than max";

	if(minAttr && maxAttr && min === max)
		code += `if(${fromVariable}.length !== ${min})\nthrow(${locale.expectedExactLen(from, min)});\n\n`;
	else {
		if(minAttr)
			code += `if(${fromVariable}.length < ${min})\nthrow(${locale.expectedMinLen(from, min)});\n\n`;
		if(maxAttr)
			code += `if(${fromVariable}.length > ${max})\nthrow(${locale.expectedMaxLen(from, max)});\n\n`;
	}

	return code;
}

function patternCheck(fromVariable, from, node) {
	let pattern = node.attr("pattern");
	if(pattern) {
		pattern = pattern.value();
		let patternError = node.attr("patternError");
		patternError = patternError ? JSON.stringify(patternError.value()) : locale.expectedPattern(from);
		return `if(!${fromVariable}.match(/${pattern}/))\nthrow(${patternError});\n\n`;
	}
	return "";
}

function checkCheck(fromVariable, from, node) {
	let check = node.attr("check");
	if(check) {
		check = check.value();
		check = check.replace(/@\w+/g, match => utils.getVariableFor(match.substr(1)));
		check = check.replace(/this/g, fromVariable);
		let checkError = node.attr("checkError");
		checkError = checkError ? JSON.stringify(checkError.value()) : locale.expectedCheck(from);
		return `if(!(${check}))\nthrow(${checkError});\n\n`;
	}
	return "";
}

function minMaxValueCheck(fromVariable, from, node) {

	let code = "";
	
	let minAttr = node.attr("min");
	let maxAttr = node.attr("max");
	let min, max;

	if(minAttr)
		min = parseFloat(minAttr.value());

	if(maxAttr)
		max = parseFloat(maxAttr.value());

	if(minAttr && maxAttr && min > max)
		throw "min can't be more than max";

	if(minAttr && maxAttr && min === max)
		code += `if(${fromVariable} !== ${min})\nthrow(${locale.expectedExactValue(from, min)});\n\n`;
	else {
		if(minAttr)
			code += `if(${fromVariable} < ${min})\nthrow(${locale.expectedMinValue(from, min)});\n\n`;
		if(maxAttr)
			code += `if(${fromVariable} > ${max})\nthrow(${locale.expectedMaxValue(from, max)});\n\n`;
	}

	return code;
}

function string(node) {
	console.assert(node.childNodes().length === 0, "string should not have children");

	const {from, fromVariable} = getFromFor(node);

	let code = "";
	
	code += stringCheck(fromVariable, from);
	code += minMaxLenCheck(fromVariable, from, node);
	code += patternCheck(fromVariable, from, node);
	code += checkCheck(fromVariable, from, node);

	return code;
}


function email(node) {
	console.assert(node.childNodes().length === 0, "email should not have children");

	let code = "";
	const {from, fromVariable} = getFromFor(node);

	code += stringCheck(fromVariable, from);
	code += minMaxLenCheck(fromVariable, from, node);
	code += `if(!${fromVariable}.match(EMAIL_REGEX))\nthrow(${locale.expectedEmail(from)});\n\n`;
	code += patternCheck(fromVariable, from, node);
	code += checkCheck(fromVariable, from, node);
	
	return code;
}

function integer(node) {
	console.assert(node.childNodes().length === 0, "string should not have children");

	const {from, fromVariable} = getFromFor(node);
	
	let code = "";

	code += `${fromVariable} = parseFloat(${fromVariable});\n\nif(!Number.isInteger(${fromVariable}))\nthrow(${locale.expectedInteger(from)});\n\n`;
	code += minMaxValueCheck(fromVariable, from, node);
	code += checkCheck(fromVariable, from, node);

	return code;
}


function number(node) {
	console.assert(node.childNodes().length === 0, "string should not have children");

	let code = "";
	const {from, fromVariable} = getFromFor(node);

	code += `${fromVariable} = parseFloat(${fromVariable});\n\nif(!Number.isFinite(${fromVariable}))\nthrow(${locale.expectedNumber(from)});\n\n`;
	code += minMaxValueCheck(fromVariable, from, node);
	code += checkCheck(fromVariable, from, node);

	return code;
}

function object(node) {
	let code = "";
	const {from, fromVariable} = getFromFor(node);

	code += `if(typeof ${fromVariable} !== "object" || Array.isArray(${fromVariable}))\n throw(${locale.expectedObject(from)});\n\n`;
	code += checkCheck(fromVariable, from, node);

	for(let child of node.childNodes())
		if(child.type() === "element")
			code += checkValue(child);

	return code;
}

function defaultCheck(node) {
	let errorMessage = node.get("string(@error)");
	if(errorMessage)
		errorMessage = JSON.stringify(errorMessage);

	let prefix = "!(", postfix = ")";

	if(node.name() === "not") {
		node = node.childNodes().filter(n => n.type() === "element")[0];
		prefix = postfix = "";
	}

	return `if(${prefix+utils.generateValue(node)+postfix})\nthrow(${errorMessage || locale.defaultError()});\n\n`;
}
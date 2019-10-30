module.exports = {
	generateDbQueryCode,
	generateQueryFragmentsVar
}


const utils = require("./utils");
const optGen = require("./optionsGenerator");

const qfdict = {};

function getQueryFragVar(dbQuery) {
	let path = dbQuery.path(); 
	if(qfdict[path])
		return qfdict[path];
	qfdict[path] = "queryFrag" + (Object.keys(qfdict).length + 1);
	return qfdict[path];
}

function generateQueryFragmentsVar(dbQuery) {
	if(!dbQuery.find("./options").length)
		return "";

	let queryElements = [];
	let fragElements = [];
	for(child of dbQuery.childNodes()) {
		let isElement = child.type() === "element";

		if(isElement && child.name() === "options") {
			// flush frag
			if(fragElements.length)
				queryElements.push(`{elements: [[${fragElements.join(", ")}]]}`);
			// add options frag
			queryElements.push(optGen.optionsVariable(child));
			fragElements = [];
		} else {
			// add element to frag
			fragElements.push(`{type: "${isElement ? "var" : "text"}", value: ${utils.normalizeSpacing(utils.generateValue(child))}}`);
		}
	}
	// flush frag
	if(fragElements.length)
		queryElements.push(`{elements: [[${fragElements.join(", ")}]]}`);

	return "const "+getQueryFragVar(dbQuery)+" = ["+queryElements.join(", ")+"];\n";
}

function generateDbQueryCode(dbQuery) {
	console.assert(dbQuery.name() === "dbQuery", "generateDbQueryCode must receive a dbQuery node");
	let children = dbQuery.childNodes();

	if(!children.length)
		return "";

	let result;
	let functionName = "db.query";

	if(children.length === 1 && children[0].type() !== "element") {
		result = utils.normalizeSpacing(utils.generateValue(children[0]));
	} else {
		let options = dbQuery.find("./options");
		if(options.length) {
			functionName = "callFragmentedQuery";
			result = getQueryFragVar(dbQuery);
		} else {
			let query = "";
			let variablesId = {};
			let variables = [];
			for(child of children) {
				if(child.type() === "element") {
					let varName = utils.normalizeSpacing(utils.generateValue(child));
					variables.push(varName);
					if(!variablesId[varName])
						variablesId[varName] = variables.length;
					query += "$" + variablesId[varName];
				} else {
					query += child.text();
				}
			}
			result = JSON.stringify(query.replace(/[\s\n\t]+/g, ' ')) + ", [" + variables.join(", ") + "]";
		}
	}

	return "(" + utils.generateAwaitCode(dbQuery) + functionName + "(" + result + "))" + generateDbReturnCode(dbQuery);
}

function generateDbReturnCode(dbQuery) {
	console.assert(dbQuery.name() === "dbQuery", "node must be of type dbQuery");
	if(dbQuery.get("string(./@singleRow)") === "true")
		return ".rows[0]";
	return ".rows";
}
module.exports = {
	generatePreErrorHandlerCode,
	generateErrorHandlerCode
}

const PG_ERRORS = require('pg-error-constants');

function generatePreErrorHandlerCode(routeXml) {
	return "try {\n\n".repeat(routeXml.find("onError").length);
}

function generateErrorHandlerCode(onErrorXml, recursion) {
	let check = isError(onErrorXml.get("string(@category)"), onErrorXml.get("string(@type)"), onErrorXml.get("string(@name)"));
	if(check)
		return "\n} catch(error) {\nif(" + check + ") {\nconsole.log(error);\n" + recursion(onErrorXml) + "} else {\n throw error;\n}\n}\n";
	return "\n} catch(error) {\nconsole.log(error);\n" + recursion(onErrorXml) + "}\n";
}

function isError(category, type, name) {
	let result = [];
	if(category === "database") {
		result.push("error.severity");
		if(type) {
			console.assert(type in PG_ERRORS, `database error type '${type}' doesn't exist`);
			let code = PG_ERRORS[type];
			if(code.endsWith("000"))
				result.push(`error.code.startsWith(${JSON.stringify(code.substr(0, 2))})`);
			else
				result.push(`error.code === ${JSON.stringify(code)}`);
		}
		if(name)
			result.push(`error.constraint === ${JSON.stringify(name)}`);
	} else if(category) {
		throw "invalid error category '" + category + "'";
	}
	return result.join(" && ");
}
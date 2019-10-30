module.exports = generateRouteInputCheckCode;

const utils = require("./utils");
const locale = require("../locale").getLocale();

//                  /        |      \
//              opgroup(a)  var(b)  var(g)
//               /   |    \    
//       opt(a.b) opt(a.c) opt(a.a)
//        /    \       \    
//    var(b)  var(e)   var(f)   
//
//
//  b
//  g
//  a => (a.b => e, a.c => f) 
//
// sono tutte variabli, anche le option e opgroup.
// quindi costruisco un albero dove i padri determinano se controllare i figli
// elimini i controlli ridondanti
// generato il codice come if annidati dove i piu' esterni sono prodotti dati nodi piu vicini alla radice

function checkRequestVariableAccessCode(accessorsProcessed, variable, description="") {
	let code = "";
	let varType = variable.name();
	let accessors = variable.text().split(".");
	console.assert(accessors.length <= 1 || variable.name() === "body", "only body can have nested fields");
	let partialAccessor = utils.getVariableFor(varType);
	for (var i = 0; i < accessors.length - 1; i++) {
		partialAccessor += utils.asAccessor(accessors[i]);
		if(!accessorsProcessed.has(partialAccessor)) {
			accessorsProcessed.add(partialAccessor);
			let message = accessors.slice(0, i+1).reverse().join(locale.of());
			code += `if(!${partialAccessor})\nthrow(${locale.mandatoryParamether(message, varType, description)});\n`;
		}
	}

	partialAccessor = `${partialAccessor+utils.asAccessor(accessors[accessors.length-1])} === undefined`;
	// last paramether
	if(!accessorsProcessed.has(partialAccessor)) {
		accessorsProcessed.add(partialAccessor);
		let message = accessors.slice(0, i+1).reverse().join(locale.of());
		code += `if(${partialAccessor})\nthrow(${locale.mandatoryParamether(message, varType, description)});\n`;
	}
	return code;
}


function generateRouteInputCheckCode(route) {
	console.assert(route.name() === "route", "generateRouteInputCheckCode must receive a route node");
	
	let result = "";
	let accessorsProcessed1 = new Set();

	// check variables not in options (always required)
	let variables = route.find(".//*[not(self::option)]/*[self::body | self::query | self::param | self::request]");

	for(let variable of variables)
		result += checkRequestVariableAccessCode(accessorsProcessed1, variable);

	// check variables in options (required only when option is used)
	let optionsGroups = route.find(".//options");

	for(let optionsGroup of optionsGroups) {
		let options = optionsGroup.childNodes();

		let accessorsProcessed2 = new Set(accessorsProcessed1);

		let hasOptionsGroupCode = optGen.hasOptionsGroupCode(optionsGroup);
		if(accessorsProcessed2.has(hasOptionsGroupCode))
			hasOptionsGroupCode = "";
		else
			accessorsProcessed2.add(hasOptionsGroupCode);

		let optionGroupCode = "";
		let opsGroupName = optionsGroup.get("string(@name)");

		for(let option of options) {
			if(option.name() === "option") {
				let variables = option.find(".//body | .//query | .//param | .//request");
				let accessorsProcessed3 = new Set(accessorsProcessed2);

				let hasOptionCode = optGen.hasOptionCode(option);
				if(accessorsProcessed3.has(hasOptionCode))
					hasOptionCode = "";
				else
					accessorsProcessed3.add(hasOptionCode);

				let optionCode = "";
				let optionName = option.get("string(@name)");

				for(let variable of variables)
					optionCode += checkRequestVariableAccessCode(accessorsProcessed3, variable, locale.usingOption(optionName, opsGroupName));

				if(optionCode)
					optionGroupCode += hasOptionCode ? `if(${hasOptionCode}) {\n${optionCode}}\n` : optionCode;
			}
		}
		if(optionGroupCode)
			result += hasOptionsGroupCode ? `if(${hasOptionsGroupCode}) {\n${optionGroupCode}}\n` : optionGroupCode;
	}
	if(result)
		result += "\n";
	return result;
}

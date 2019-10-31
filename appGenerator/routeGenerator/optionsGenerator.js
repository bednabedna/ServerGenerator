module.exports = {
	generatePreOptionsCode,
	optionsVariable,
	optionsDeclaration,
	optionsInStringDeclaration,
	optionsInDbQueryDeclaration,
	hasOptionCode,
	hasOptionsGroupCode
};

const {
	asObjectKey,
	generateTemplatedString,
	asJsVarName,
	getVariableFor,
	asAccessor,
	generateValue,
	normalizeSpacing
} = require("./utils");

function checkNames(names) {
	let existing = {};
	for(let name of names) {
		let varName = asJsVarName(name);
		if(varName in existing)
			throw `'${name}' is colliding with '${existing[varName]}'`;
		else
			existing[varName] = name;
	}
}

function generateOptionsValuesForString(options) {
	console.assert(options.name() === "options", "node must be of type options");
	let optionsArray = [];

	for(let opt of options.find("./option"))
		optionsArray.push(asObjectKey(opt.get("string(./@name)")) + ": " + generateTemplatedString(opt));

	return "{" + optionsArray.join(",\n") + "}";
}

function generateQueryFrag(option) {
	let result = [];
	for(let child of option.childNodes())
		result.push(`{type: "${child.type() === "text" ? "text" : "var"}", value: ${normalizeSpacing(generateValue(child))}}`);
	return "[" + result.join(",") + "]";
}

function generateOptionsValuesForQuery(options) {
	console.assert(options.name() === "options", "node must be of type options");
	let optionsArray = [];

	for(let opt of options.find("./option"))
		optionsArray.push(asObjectKey(opt.get("string(./@name)")) + ": " + generateQueryFrag(opt));

	return "{" + optionsArray.join(",\n") + "}";
}

function generatePreOptionsCode(route)  {
	console.assert(route.name() === "route", "route node must be of type route");

	const optionsGroups = route.find(".//options");

	checkNames(optionsGroups.map(og => og.attr("name").value()));

	let result = "";
	
	for(let optionGroup of optionsGroups) {
		const isDbQueryTopLevelOptions = optionGroup.parent().name() === "dbQuery";

		let optionsName = optionGroup.get("string(./@name)");
		let optionsFrom = optionGroup.get("string(./@from)")         || 'query';
		let optionsJoin = optionGroup.get("string(./@join)")         || ', ';
		let optionsMin = parseInt(optionGroup.get("string(./@min)")) ||  0;
		let optionsMax = parseInt(optionGroup.get("string(./@max)")) || -1;

		let optionsVar = optionsVariable(optionGroup);
		let optionsValues = isDbQueryTopLevelOptions ? generateOptionsValuesForQuery(optionGroup) : generateOptionsValuesForString(optionGroup);
		
		if(optionsFrom === "body")
			console.assert(optionGroup.get("string(ancestor::route/@type)") === "post", "optionGroup using body must be in post route");

		result += `
		const ${optionsVar} = ${ isDbQueryTopLevelOptions ? "optionsToQueryFragment" : "optionsToString"}(
			{
				name: ${JSON.stringify(optionsName)},
				options: ${optionsValues},
				from: ${JSON.stringify(optionsFrom)},
				min: ${optionsMin},
				max: ${optionsMax},
				join: ${JSON.stringify(optionsJoin)}
			},
			${getVariableFor(optionsFrom)}
		);

		if(${optionsVar}.error)
			return response.status(400).send(${optionsVar}.error);
		
		`;
	}
	return result;
}

function hasOptionsGroupCode(optionsGroup) {
	let optionsGroupName = optionsGroup.attr("name").value();
	let source = getVariableFor(optionsGroup.attr("from") || "query");
	return `${source+asAccessor(optionsGroupName)} !== undefined`;
}

function hasOptionCode(option) {
	let optionsGroup = option.parent();
	let optionGroupAccessor = asAccessor(optionsGroup.attr("name").value());
	let optionName = option.attr("name").value();
	let source = getVariableFor(optionsGroup.attr("from") || "query");
	return `${source+optionGroupAccessor} === ${JSON.stringify(optionName)}`;
}

function optionsVariable(optionGroup) {
	console.assert(optionGroup.name() === "options", "optionGroup node must be of type options");
	return asJsVarName(optionGroup.get("string(./@name)")) + "_options";
}

function optionsDeclaration() {
	return `
function optionsToFragmentElements(optionsGroup, src) {
	let optionsValues = [];
	if(optionsGroup.name in src) {
		let options = optionsGroup.options;
		for(let option of src[optionsGroup.name].split(",")) {
			option = option.trim();
			if(option in options) {
				optionsValues.push(options[option]);
			} else {
				return \`unknow value '\${option}' for '\${optionsGroup.name}' in \${optionsGroup.from}"\`;
			}
		}
		if(optionsGroup.min > optionsValues.length)
			return \`too few options for '\${optionsGroup.name}' in \${optionsGroup.from}, \${optionsGroup.min} required, \${optionsValues.length} received.\`;
		if(optionsGroup.max !== -1 && optionsGroup.max < optionsValues.length)
			return \`too many options for '\${optionsGroup.name}' in \${optionsGroup.from}, \${optionsGroup.max} maximum, \${optionsValues.length} received.\`;
	} else if(optionsGroup.min > 0) {
		return \`option '\${optionsGroup.name}' required in \${optionsGroup.from}\`;
	}
	return optionsValues;
}
`;
}

function optionsInStringDeclaration() {
	return `
function optionsToString(optionsGroup, src) {
	let elements = optionsToFragmentElements(optionsGroup, src);
	if(typeof elements === "string")
		return {error: elements};
	return elements.join(optionsGroup.join);
}
`;
}

function optionsInDbQueryDeclaration() {
	return `
function optionsToQueryFragment(optionsGroup, src) {
	let elements = optionsToFragmentElements(optionsGroup, src);
	if(typeof elements === "string")
		return {error: elements};
	return {elements: elements, join: optionsGroup.join};
}

function callFragmentedQuery(queryFragment) {
	let offset = 0;
	let text = "", args = [];

	for(let frag of queryFragment)
		text += frag.elements.map(option =>
			option.map(e => {
				if(e.type === "text")
					return e.value;
				args.push(e.value);
				return "$" + ++offset;
			})
			.join("")
		)
		.join(frag.join || "");

	return db.query(text, args);
}
`;
}
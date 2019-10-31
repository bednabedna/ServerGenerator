if(process.argv.length !== 3) {
	console.error("Usage: server <XML_CONFIGSPath>");
	process.exit(-1);
}

const fs = require("fs-extra");
const path = require("path");
const libxml = require("libxmljs");


const XML_CONFIG_PATH = process.argv[2];
const OUTPUT_FOLDER = path.dirname(XML_CONFIG_PATH);
const XML_CONFIGS = libxml.parseXml(fs.readFileSync(XML_CONFIG_PATH));

const GEN_APP_FOLDER = path.join(__dirname, "../generated-apps", XML_CONFIGS.get("string(/app/@name)"));
const GEN_INDEX_PATH = path.join(GEN_APP_FOLDER, "index.js");
const GEN_ROTUER_PATH = path.join(GEN_APP_FOLDER, "router.js");

/*
 * Check which files must be updated
 */

let indexWasModified = true, routerWasModified = true;

const NOTHING = 0, INDEX = 1 << 0, ROUTER = 1 << 1;

let needsUpdate = ~NOTHING;

const matches = (x, y) => (x & y) > 0;

let files = [
	{path: GEN_INDEX_PATH,  modifies: NOTHING},
	{path: GEN_ROTUER_PATH, modifies: NOTHING},
	{path: XML_CONFIG_PATH, modifies: INDEX | ROUTER},
	...XML_CONFIGS.find("/app/database/dbScript").map(e => ({path: e.text(), modifies: INDEX}))
];

Promise.all(
	files.map(file =>
		fs.stat(file.path)
		.then(stat => ({mt: stat.mtimeMs, modifies: file.modifies}))
	)
)
.then(result => {
	const indexMt = result[0].mt;
	const routerMt = result[1].mt;

	needsUpdate = NOTHING;

	for(let file of result) {
		if(
			(matches(file.modifies, INDEX) && file.mt > indexMt) ||
			(matches(file.modifies, ROUTER) && file.mt > routerMt)
		)
			needsUpdate = needsUpdate | file.modifies;
	}

	fs.writeFileSync("./debug.json", JSON.stringify(a))

	if(needsUpdate === NOTHING) {
		process.stdout.write(GEN_INDEX_PATH);
		process.exit(0);
	}
})
.catch(() => {});

/*
 * Config Xml modified, regenerate app
 */

const beautifyJs = require("js-beautify").js;
const generateIndex = require("./indexGenerator");
const generateRoutes = require("./routeGenerator");

/*
 * Check costraints
 */
console.assert(XML_CONFIGS.get("string(/app/@name)"), "app name is mandatory");
console.assert(!XML_CONFIGS.find("//dbQuery").length || XML_CONFIGS.get("/app/database"), "cannot user dbQuery without databse");

/*
 * Set language
 */
let locale = require("./locale").setLanguage(XML_CONFIGS.get("string(/app/@locale)") || "en");

/*
 * Generate app files
 */

fs.ensureDir(GEN_APP_FOLDER)
.then(() => {
	let promises = [];

	if(matches(needsUpdate, INDEX))
		promises.push(
			generateIndex(XML_CONFIGS, OUTPUT_FOLDER)
			.then(generatedIndex => fs.writeFile(GEN_INDEX_PATH, beautifyJs(generatedIndex)))
		);

	if(matches(needsUpdate, ROUTER))
		promises.push(
			generateRoutes(XML_CONFIGS, OUTPUT_FOLDER)
			.then(generatedRoutes => fs.writeFile(GEN_ROTUER_PATH, beautifyJs(generatedRoutes)))
		);

	return Promise.all(promises);
})
.then(() => {
	process.stdout.write(GEN_INDEX_PATH);
})
.catch(error => {
	console.error(error);
	process.exit(-1);
});
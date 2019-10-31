if(process.argv.length !== 3) {
	console.error("Usage: server <XML_CONFIGSPath>");
	process.exit(-1);
}

const fs = require("fs-extra");
const path = require("path");
const libxml = require("libxmljs");
const beautifyJs = require("js-beautify").js;

const generateIndex = require("./indexGenerator");
const generateRoutes = require("./routeGenerator");

const XML_CONFIG_PATH = process.argv[2];
const OUTPUT_FOLDER = path.dirname(XML_CONFIG_PATH);
const XML_CONFIGS = libxml.parseXml(fs.readFileSync(XML_CONFIG_PATH));

const GEN_APP_FOLDER = path.join(__dirname, "../generated-apps", XML_CONFIGS.get("string(/app/@name)"));
const GEN_INDEX_PATH = path.join(GEN_APP_FOLDER, "index.js");
const GEN_ROTUER_PATH = path.join(GEN_APP_FOLDER, "router.js");


/*
 * Check costraints
 */
console.assert(XML_CONFIGS.get("string(/app/@name)"), "app name is mandatory");
console.assert(!XML_CONFIGS.find("//dbQuery").length || XML_CONFIGS.get("/app/database"), "cannot user dbQuery without databse");

/*
 * Set language
 */
let locale = require("./locale").setLanguage(XML_CONFIGS.get("string(/app/@locale)") || "en");

fs.ensureDir(GEN_APP_FOLDER)
.then(() => Promise.all([
	generateIndex(XML_CONFIGS, OUTPUT_FOLDER)
	.then(generatedIndex => fs.writeFile(GEN_INDEX_PATH, beautifyJs(generatedIndex))),
	generateRoutes(XML_CONFIGS, OUTPUT_FOLDER)
	.then(generatedRoutes => fs.writeFile(GEN_ROTUER_PATH, beautifyJs(generatedRoutes)))
]))
.then(() => {
	process.stdout.write(GEN_INDEX_PATH);
})
.catch(error => {
	console.error(error);
	process.exit(-1);
});
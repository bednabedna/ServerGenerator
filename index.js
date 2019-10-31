if(process.argv.length !== 3) {
	console.error("Usage: server <XML_CONFIGSPath>");
	process.exit(-1);
}

const path = require("path");

// generate app
console.log("generating", process.argv[2] + "...");

require('child_process').exec(`node ${path.join(__dirname, "appGenerator/index.js")} ${process.argv[2]}` , function callback(error, stdout, stderr){
    if(error || stderr) {
    	console.error(stderr);
    	process.exit(-1);
    }
    // execute generated app
    console.log("starting", stdout);
    require(path.relative(process.cwd(), stdout));
});
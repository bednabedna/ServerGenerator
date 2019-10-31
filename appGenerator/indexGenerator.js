module.exports = generateIndexCode;

const fs = require("fs-extra");
const path = require("path");

async function generateIndexCode(xmlConfigs, outputpath) {
	let generatedCode = '';

	const code = str => {
		generatedCode += str;
	};

	const string = JSON.stringify;


	code(`
	const express = require('express');

	/**
	 * Create new app
	 */
	const app = express();

	app.isProduction = function() {
	  return this.get('env') === "production";
	}

	app.isDevelopment = function() {
	  return this.get('env') === "development";
	}

	/**
	 * Use response compression
	 */
	const compression = require('compression');

	app.use(compression());

	/**
	 * Dev requests logging
	 */
	if(app.isDevelopment())
	  app.use(require('morgan')('dev'));

	/**
	 * lusca for security
	 */
	const lusca = require('lusca');

	if(!app.isDevelopment()) {
	  app.use((req, res, next) => lusca.csrf()(req, res, next));
	  /*app.use((err, req, res, next) => {
	    // log csfr error
	    console.error("[CSFR Error]", err.message);
	    res.end();
	  });*/
	}
	app.use(lusca.xframe('SAMEORIGIN'));
	app.use(lusca.hsts({ maxAge: 31536000 }));
	app.use(lusca.xssProtection(true));
	app.use(lusca.nosniff());
	app.use(lusca.referrerPolicy('same-origin'));

	`);

	if(xmlConfigs.get("//route[@type='post']")) {
		code(`
		/**
		 * Use bodyParser to get POST body
		 */
		const bodyParser = require('body-parser');

		app.use(bodyParser.json());
		app.use(bodyParser.urlencoded({ extended: false}));
		`);
	}

	if(xmlConfigs.get("/app/database")) {

		if(xmlConfigs.get("/app/authentication")) {
			code(`
			/**
			 * Cookies, GNAM!
			 */
			const expressSession = require('express-session');

			app.use(expressSession({
			  resave: false,
			  saveUninitialized: true,
			  cookie: { secure: app.isProduction() },
			  secret: "-ia0sdj^%${xmlConfigs.get("string(/app/@name)") + xmlConfigs.get("string(/app/database/@name)")}_ah9!*d98ha&*"
			}));
			app.use(require('cookie-parser')());

			/**
			 * Configure and use Passport for authentication
			 */
			const authentication = require('../../authentication');

			

			authentication.setLocalStrategy(
				${string(xmlConfigs.get("string(/app/@locale)") || "en")},
				${string(xmlConfigs.get("string(/app/authentication/@modelName)"))},
				${(() => {
					let usernameFields = xmlConfigs.get("string(/app/authentication/@usernameFields)") || xmlConfigs.get("string(/app/authentication/@usernameField)");
					return string(usernameFields.split(",").map(f => f.trim()).filter(f => f));
				})()},
				${string(xmlConfigs.get("string(/app/authentication/@passwordField)"))},
				${string(xmlConfigs.get("string(/app/authentication/@serializeField)"))}
			);
			app.use(authentication.initialize());
			app.use(authentication.session());
			`);

			if(xmlConfigs.get("/app/viewEngine")) {
				/**
				 * Include some default local variables in views
				 */
				code(`
				app.use((req, res, next) => {
				  res.locals.currentUser = req.user;
				  next();
				});
				`);
			}			
		}
		/**
		 * Connect db
		 */
		let dbName = xmlConfigs.get("string(/app/database/@name)");

		code(`
		const db = require('../../db');

		let dbConfig = {
			name:      ${string(dbName)},
			host:      ${string(xmlConfigs.get("string(/app/database/@host)"))},
			port:      ${parseInt(xmlConfigs.get("string(/app/database/@port)"))},
			user:      ${string(xmlConfigs.get("string(/app/database/credentials/@user)"))},
			password:  ${string(xmlConfigs.get("string(/app/database/credentials/@password)"))}
		};

		console.log("connecting to database...");

		db.connect(dbConfig)
		.then(() => console.log("connected to '${dbName}' database."))
	  	.catch(error => {
	  		console.error(error.toString() || "cannot connect to database.");
	  		process.exit(-1);
	  	});
	  	`);

	  	let scriptsAndQueries = xmlConfigs.find("/app/database/dbQuery | /app/database/dbScript");

	  	if(scriptsAndQueries.length) {
	  		/**
			 * Execute queries and SQL scripts
			 */
	  		for(let queryOrFile of scriptsAndQueries) {
	  			let queryText = "";
	  			let name = queryOrFile.name();
	  			if(name === "dbScript")
	  				queryText = fs.readFileSync(path.join(outputpath, queryOrFile.text()), "utf-8");
	  			else if(name === "dbQuery")
	  				queryText = queryOrFile.text();
	  			else
	  				throw "invalid child " + name + " for database";
	  			code(`db.query(${string(queryText)});\n`);
	  		}
	  	}
	}

	if(xmlConfigs.get("/app/emails")) {
		/**
		 * Initialize email system
		 */
		code(`
		const emails = require("../../emails");
		const mailer = require("express-mailer");
		const emailAddress = ${string(xmlConfigs.get("string(/app/emails/credentials/@address)"))};

		emails.mailer = mailer.extend(app, {
			from: \`${string(xmlConfigs.get("string(/app/@name)"))} <\${emailAddress}>\`,
			host: ${string(xmlConfigs.get("string(/app/emails/@host)") || "smtp.gmail.com")},
			secureConnection: ${xmlConfigs.get("string(/app/emails/@secureConnection)") === "true" || true},
			port: ${parseInt(xmlConfigs.get("string(/app/emails/@port)")) || 465},
			auth: {
				user: emailAddress,
				pass: ${string(xmlConfigs.get("string(/app/emails/credentials/@password)"))}
			}
		}, err => {
			if(err)
				throw err;
			console.log("using mailer address " + emailAddress);
		}).mailer;
		`);
	}


	if(xmlConfigs.get("/app/viewEngine")) {
		/**
		 * View Engine
		 */
		const VIEWS_PATH = path.join(outputpath, xmlConfigs.get("string(/app/viewEngine/@folder)"));
		try { fs.ensureDir(VIEWS_PATH); } catch(_) { }
		code(`console.log("using ${VIEWS_PATH} as view folder.");\n`);
		code(`app.set("views", ${string(VIEWS_PATH)});\n`);
		let viewEngineName = xmlConfigs.get("string(/app/viewEngine/@name)");
		//require(viewEngineName);
		code(`app.set("view engine",  ${string(viewEngineName)});\n`);
	}

	const publicFolders = xmlConfigs.find("/app/publicFolders | /app/publicFolder");

	if(publicFolders) {
		/**
		 * Make folders content publicly "requestable"
		 */
		for(let folder of publicFolders) {
			let realPath = path.join(outputpath, folder.get("string(./@realFolder)"));
			try { fs.ensureDir(realPath); } catch(_) { }
			let virtualPath = folder.get("string(./@virtualFolder)");
			code(`console.log("redirecting", ${string(virtualPath)}, "to public folder", ${string(realPath)} + ".");\n`);
			code(`app.use(${string(virtualPath)}, express.static(${string(realPath)}));\n`);
		}
	}

	/**
	 * Load routes
	 */
	code(`app.use("/", require("./router"));\n`);

	/**
	 * Listen for connections
	 */
	const PORT = parseInt(xmlConfigs.get("string(/app/server/@port)")) || 8080;
	code(`app.listen(${PORT}, () => console.log(\`${xmlConfigs.get("string(/app/server/@name)") || "server"} listening on ${PORT} in '\${app.get('env')}' mode.\`));`);

	return generatedCode;
}
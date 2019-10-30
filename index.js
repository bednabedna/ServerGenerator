
if(process.argv.length !== 4) {
	console.error("Usage: server <xmlConfigsPath> <outputPath>");
	process.exit(-1);
}

initializeApp(process.argv[2], process.argv[3]);


function initializeApp(xmlConfigsPath, outputPath) {

	const libxml = require("libxmljs");
	const fs = require("fs-extra");
	const path = require("path");
	const express = require('express');

	function resolvePath(p) {
		return path.join(outputPath, p);
	} 
	
	/**
	 * Load configs
	 */

	let xmlConfigs = libxml.parseXml(fs.readFileSync(xmlConfigsPath));

	/*
	 * Check costraints
	 */
	console.assert(xmlConfigs.get("string(/app/@name)"), "app name is mandatory");
	console.assert(!xmlConfigs.find("//dbQuery").length || xmlConfigs.get("/app/database"), "cannot user dbQuery without databse");

	/*
	 * Set language
	 */
	let locale = require("./locale").setLanguage(xmlConfigs.get("string(/app/@locale)") || "en");

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


	if(xmlConfigs.get("//route[@type='post']")) {
		/**
		 * Use bodyParser to get POST body
		 */
		const bodyParser = require('body-parser');

		app.use(bodyParser.json());
		app.use(bodyParser.urlencoded({ extended: false}));
	}

	if(xmlConfigs.get("/app/database")) {

		if(xmlConfigs.get("/app/authentication")) {
			/**
			 * Cookies, GNAM!
			 */
			const expressSession = require('express-session');

			app.use(expressSession({
			  resave: false,
			  saveUninitialized: true,
			  cookie: { secure: app.isProduction() },
			  secret: "-ia0sdj^%" + xmlConfigs.get("string(/app/@name)") + xmlConfigs.get("string(/app/database/@name)") + "_ah9!*d98ha&*"
			}));
			app.use(require('cookie-parser')());

			/**
			 * Configure and use Passport for authentication
			 */
			const authentication = require('./authentication');

			let usernameFields = xmlConfigs.get("string(/app/authentication/@usernameFields)") || xmlConfigs.get("string(/app/authentication/@usernameField)");

			usernameFields = usernameFields.split(",").map(f => f.trim()).filter(f => f);

			authentication.setLocalStrategy(
				xmlConfigs.get("string(/app/authentication/@modelName)"),
				usernameFields,
				xmlConfigs.get("string(/app/authentication/@passwordField)"),
				xmlConfigs.get("string(/app/authentication/@serializeField)")
			);
			app.use(authentication.initialize());
			app.use(authentication.session());

			if(xmlConfigs.get("/app/viewEngine")) {
				/**
				 * Include some default local variables in views
				 */
				app.use((req, res, next) => {
				  res.locals.currentUser = req.user;
				  next();
				});
			}			
		}

		/**
		 * Connect db
		 */
		const db = require('./db');

		let dbConfig = {
			name:      xmlConfigs.get("string(/app/database/@name)"),
			host:      xmlConfigs.get("string(/app/database/@host)"),
			port:      parseInt(xmlConfigs.get("string(/app/database/@port)")),
			user:      xmlConfigs.get("string(/app/database/credentials/@user)"),
			password:  xmlConfigs.get("string(/app/database/credentials/@password)")
		};

		console.log("connecting to database...");

		db.connect(dbConfig)
		.then(() => console.log(`connected to '${dbConfig.name}' database.`))
	  	.catch(error => {
	  		console.error(error.toString() || "cannot connect to database.");
	  		process.exit(-1);
	  	});

		/**
		 * Execute queries and SQL scripts
		 */
		for(let queryOrFile of xmlConfigs.find("/app/database/sqlQuery | /app/database/sqlScript")) {
			let queryText = "";
			if(queryOrFile.name() === "sqlScript")
				queryText = fs.readFileSync(resolvePath(queryOrFile.text()));
			else
				queryText = queryOrFile.text();
			db.query(queryText);
		}
	}

	if(xmlConfigs.get("/app/emails")) {
		/**
		 * Initialize email system
		 */
		const emails = require("./emails");
		const mailer = require("express-mailer");
		const emailAddress = xmlConfigs.get("string(/app/emails/credentials/@address)");

		emails.mailer = mailer.extend(app, {
			from: `"${xmlConfigs.get("string(/app/@name)")}" <${emailAddress}>`,
			host: xmlConfigs.get("string(/app/emails/@host)") || "smtp.gmail.com",
			secureConnection: xmlConfigs.get("string(/app/emails/@secureConnection)") === "true" || true,
			port: parseInt(xmlConfigs.get("string(/app/emails/@port)")) || 465,
			auth: {
				user: emailAddress,
				pass: xmlConfigs.get("string(/app/emails/credentials/@password)")
			}
		}, err => {
			if(err)
				throw err;
			console.log("using mailer address " + emailAddress);
		}).mailer;
	}


	if(xmlConfigs.get("/app/viewEngine")) {
		/**
		 * View Engine
		 */
		const VIEWS_PATH = resolvePath(xmlConfigs.get("string(/app/viewEngine/@folder)"));
		try { fs.ensureDir(VIEWS_PATH); } catch(_) { }
		console.log("using", VIEWS_PATH, "as view folder.");
		app.set("views", VIEWS_PATH);
		let viewEngineName = xmlConfigs.get("string(/app/viewEngine/@name)");
		//require(viewEngineName);
		app.set("view engine",  viewEngineName);
	}

	const publicFolders = xmlConfigs.find("/app/publicFolders | /app/publicFolder");

	if(publicFolders) {
		/**
		 * Make folders content publicly "requestable"
		 */

		for(let folder of publicFolders) {
			let realPath = resolvePath(folder.get("string(./@realFolder)"));
			try { fs.ensureDir(realPath); } catch(_) { }
			let virtualPath = folder.get("string(./@virtualFolder)");
			console.log("redirecting", virtualPath, "to public folder", realPath + ".");
			app.use(virtualPath, express.static(realPath));
		}
	}

	let routes = xmlConfigs.get("/app/routes");
	if(routes) {
		/**
		 * Generate routes
		 */
		const generateRoutes = require("./routeGenerator");
		const routerPath = generateRoutes(routes, !app.isProduction(), resolvePath);
		app.use("/", require(routerPath));
	}

	/**
	 * Listen for connections
	 */
	const PORT = parseInt(xmlConfigs.get("string(/app/server/@port)")) || 8080;
	app.listen(PORT, () => console.log(`${xmlConfigs.get("string(/app/server/@name)") || "server"} listening on ${PORT} in '${app.get('env')}' mode.`));

	/**
	 * Unload modules used for initialization
	 */
	delete require.cache[require.resolve('libxmljs')];
}
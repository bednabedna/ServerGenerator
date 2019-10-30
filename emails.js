const moment = require("moment");

// Carica sempre la configurazione
exports.adminEmail = null;

(() => {
  const fs = require("fs");
  try {
    var config = fs.readFileSync("./config.json", 'utf8')
    if(config) { 
      config = JSON.parse(config)
      if(typeof config.adminEmail == "string" && validator.isEmail(config.adminEmail))
      exports.adminEmail = config.adminEmail
      else
        throw "invalid email"
    }
  } catch(e) {
    console.error("Errore in lettura configurazione admin email:", e)
  }
})();

exports.areEmailsActive = false;
exports.mailer = null;
exports.send = function(view, args) {
	return new Promise((resolve, reject) => {
		if(!this.areEmailsActive)
      return reject("Le email sono disabilitate");
    if(!args.to)
      return reject("Destinatario email mancante")
		this.mailer.send(view, args, err => {
			if(err)
				return reject(err);
			resolve();
		});
	});
}
exports.templates = {
	//example: (arg1, arg2, arg3) => app.send("path/to/email/view", {to: arg1, subject: arg2, something: arg3})
	resetPassword: (user) => this.send("emails/reset-password", {to: user.email, user: user, token: user.passwordResetToken, subject: `Ripristina password su ${process.env.APP_NAME}`}),
	contactUs: (email, name, message) => {
    if(this.adminEmail)
      return this.send("emails/contact-us", {to: this.adminEmail, email: email, name: name, message: message, subject: `Messaggio Utente per ${process.env.APP_NAME}`});
    return Promise.reject("Email dell'amministratore mancante")
  },
	adminNotice: (subject, message) => {
    if(this.adminEmail)
      return this.send("emails/admin-notice", {to: this.adminEmail, message: message, subject: subject});
    return Promise.reject("Email dell'amministratore mancante")
  },
  confermaAppuntamento: (email, appuntamento) => {
    return this.send("emails/conferma-appuntamento", {to: email, appuntamento: appuntamento, subject: "Conferma Appuntamento Oculista del " + moment(appuntamento.date).add(6, 'h').format("DD/MM/YYYY H:mm")});
  },
  eliminaAppuntamento: (email, appuntamento) => {
    return this.send("emails/elimina-appuntamento", {to: email, appuntamento: appuntamento, subject: "Cancellazione Appuntamento Oculista Confermata del " + moment(appuntamento.date).add(6, 'h').format("DD/MM/YYYY H:mm")});
  }
};
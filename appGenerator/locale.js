const str = JSON.stringify;

let _currentLanguage = "en";

let LOCALIZATION = {
	getLanguage: () => _currentLanguage,
	getLocale: () => LOCALIZATION.languages[_currentLanguage],
	setLanguage: (language) => {
		console.assert(typeof language === "string", "language must be a string.");
		console.assert(["en", "it"].some(l => l === language), `'${language}' is not a valid language.`);
		_currentLanguage = language;
		return LOCALIZATION.getLocale();
	},
	languages: {
		"it": {
			mandatoryParamether: (message, type, descr) => str(`il campo ${message} è obbligatorio${descr}.`),
			usingOption: (optionName, opsGroupName) => ` usando ${optionName} in ${opsGroupName}`,
			expectedString: (from) => str(`il campo ${from} dovrebbe essere una stringa.`),
			expectedEmail: (from) => str(`il campo ${from} non contiene un email valida.`),
			expectedExactLen: (from, min) => str(`il campo ${from} dovrebbe essere lungo esattamente ${min} caratteri.`),
			expectedMinLen: (from, min) => str(`il campo ${from} dovrebbe essere lungo almeno ${min} caratteri.`),
			expectedMaxLen: (from, max) => str(`il campo ${from} dovrebbe essere lungo al più ${max} caratteri.`),
			expectedExactValue: (from, min) => str(`il campo ${from} dovrebbe valere esattamente ${min}.`),
			expectedMinValue: (from, min) => str(`il campo ${from} dovrebbe valere minimo ${min}.`),
			expectedMaxValue: (from, max) => str(`il campo ${from} dovrebbe valere massimo ${max}.`),
			expectedPattern: (from) => str(`il campo ${from} non è nel formato corretto.`),
			expectedCheck: (from) => str(`il campo ${from} viola un vincolo.`),
			expectedInteger: (from) => str(`il campo ${from} deve essere un intero.`),
			expectedNumber: (from) => str(`il campo ${from} deve essere un numero.`),
			expectedObject: (from) => str(`il campo ${from} deve essere un oggetto.`),
			defaultError: (from) => str(`i dati non sono corretti.`),
			of: () => " di ",
			in: () => " in ",
			or: () => " o ",
		},
		"en": {
			mandatoryParamether: (message, type, descr) => str(`${message} field is required${descr}.`),
			usingOption: (optionName, opsGroupName) => ` using ${optionName} of ${opsGroupName}`,
			expectedString: (from) => str(`expected ${from} to be a string.`),
			expectedEmail: (from) => str(`${from} is not a valid email.`),
			expectedExactLen: (from, min) => str(`${from} should be ${min} characters long.`) ,
			expectedMinLen: (from, min) => str(`${from} should be at least ${min} characters long.`),
			expectedMaxLen: (from, max) => str(`${from} should be at most ${max} characters long.`),
			expectedExactValue: (from, min) => str(`${from} should be ${min}.`),
			expectedMinValue: (from, min) => str(`${from} should be at least ${min}.`),
			expectedMaxValue: (from, max) => str(`${from} should be at most ${max}.`),
			expectedPattern: (from) => str(`${from} is not in the correct format.`),
			expectedCheck: (from) => str(`${from} violates a costraint.`),
			expectedInteger: (from) => str(`${from} should be an integer.`),
			expectedNumber: (from) => str(`${from} should be a number.`),
			expectedObject: (from) => str(`${from} should be an object.`),
			defaultError: (from) => str(`data is not valid.`),
			of: () => " of ",
			in: () => " in ",
			or: () => " or ",
		}
	}
}

module.exports = LOCALIZATION;

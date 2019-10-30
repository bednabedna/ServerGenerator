const router = require("express").Router();
const authentication = require("../authentication");
const db = require("../db");
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
const bcrypt = require("bcrypt");
/**
 * Encript string
 */
function encrypt(string) {
    return new Promise((resolve, reject) => {
        bcrypt.genSalt(10, (err, salt) => {
            if (err)
                return reject(err);
            bcrypt.hash(string, salt, (err, hash) => {
                if (err)
                    return reject(err);
                resolve(hash);
            });
        });
    });
}

module.exports = router;

router.get("/", function(request, response, next) {
    try {
        response.render("home");

    } catch (error) {
        console.error(error);
        response.redirect('/');
    }
});

router.get("/cliente/registrati", function(request, response, next) {
    try {
        if (request.user && request.user.role !== "admin")
            return response.redirect('/');

        response.render("cliente/signup");

    } catch (error) {
        console.error(error);
        response.redirect('/');
    }
});

router.get("/pro/registrati", function(request, response, next) {
    try {
        if (request.user && request.user.role !== "admin")
            return response.redirect('/');

        response.render("pro/signup");

    } catch (error) {
        console.error(error);
        response.redirect('/');
    }
});

router.get("/account/email/:email", async function(request, response, next) {
    try {
        if (request.params.email === undefined)
            throw ("il campo email è obbligatorio.");

        if (typeof request.params !== "object" || Array.isArray(request.params))
            throw ("il campo param deve essere un oggetto.");

        if (typeof request.params.email !== "string")
            throw ("il campo email dovrebbe essere una stringa.");

        if (request.params.email.length > 50)
            throw ("il campo email dovrebbe essere lungo al più 50 caratteri.");

        if (!request.params.email.match(EMAIL_REGEX))
            throw ("il campo email non contiene un email valida.");

        if ((await db.query(" SELECT 1 FROM Account WHERE email = $1 LIMIT 1 ", [request.params.email])).rows[0])
            throw ("email già in uso.");


        response.send(`${request.params.email} non in uso.`);

    } catch (error) {
        console.error(error);
        response.status(400).send(error);
    }
});

router.get("/account/username/:username", async function(request, response, next) {
    try {
        if (request.params.username === undefined)
            throw ("il campo username è obbligatorio.");

        if (typeof request.params !== "object" || Array.isArray(request.params))
            throw ("il campo param deve essere un oggetto.");

        if (typeof request.params.username !== "string")
            throw ("il campo username dovrebbe essere una stringa.");

        if (request.params.username.length < 1)
            throw ("il campo username dovrebbe essere lungo almeno 1 caratteri.");

        if (request.params.username.length > 50)
            throw ("il campo username dovrebbe essere lungo al più 50 caratteri.");

        if ((await db.query(" SELECT 1 FROM Account WHERE username = $1 LIMIT 1 ", [request.params.username])).rows[0])
            throw ("username già in uso.");


        response.send(`${request.params.username} non in uso.`);

    } catch (error) {
        console.error(error);
        response.status(400).send(error);
    }
});

router.get("/account/login", function(request, response, next) {
    try {
        if (request.user && request.user.role !== "admin")
            return response.redirect('/');

        response.render("account/login");

    } catch (error) {
        console.error(error);
        response.redirect('/');
    }
});

router.post("/account/login", async function(request, response, next) {
    try {
        if (request.user)
            return response.status(401).send('Unauthorized');

        if (request.body.username === undefined)
            throw ("il campo username è obbligatorio.");
        if (request.body.password === undefined)
            throw ("il campo password è obbligatorio.");

        if (typeof request.body !== "object" || Array.isArray(request.body))
            throw ("il campo body deve essere un oggetto.");

        if (typeof request.body.username !== "string")
            throw ("il campo username dovrebbe essere una stringa.");

        if (request.body.username.length < 1)
            throw ("il campo username dovrebbe essere lungo almeno 1 caratteri.");

        if (request.body.username.length > 50)
            throw ("il campo username dovrebbe essere lungo al più 50 caratteri.");

        if (typeof request.body.password !== "string")
            throw ("il campo password dovrebbe essere una stringa.");

        if (request.body.password.length > 50)
            throw ("il campo password dovrebbe essere lungo al più 50 caratteri.");


        await authentication.authenticateAsync(request.body.username, request.body.password, request);
        response.send(request.user);

    } catch (error) {
        console.error(error);
        response.status(400).send(error);
    }
});

router.post("/account/logout", async function(request, response, next) {
    try {
        if (!request.user)
            return response.status(401).send('Unauthorized');

        await request.logout();
        response.send("Logout effettuato con successo.");

    } catch (error) {
        console.error(error);
        response.status(400).send(error);
    }
});

router.post("/cliente/create", async function(request, response, next) {
    try {
        try {

            if (request.user && request.user.role !== "admin")
                return response.status(401).send('Unauthorized');

            if (request.body.username === undefined)
                throw ("il campo username è obbligatorio.");
            if (request.body.email === undefined)
                throw ("il campo email è obbligatorio.");
            if (request.body.password === undefined)
                throw ("il campo password è obbligatorio.");

            if (typeof request.body !== "object" || Array.isArray(request.body))
                throw ("il campo body deve essere un oggetto.");

            if (typeof request.body.username !== "string")
                throw ("il campo username dovrebbe essere una stringa.");

            if (request.body.username.length < 1)
                throw ("il campo username dovrebbe essere lungo almeno 1 caratteri.");

            if (request.body.username.length > 50)
                throw ("il campo username dovrebbe essere lungo al più 50 caratteri.");

            if (typeof request.body.password !== "string")
                throw ("il campo password dovrebbe essere una stringa.");

            if (request.body.password.length > 50)
                throw ("il campo password dovrebbe essere lungo al più 50 caratteri.");

            if (typeof request.body["conferma password"] !== "string")
                throw ("il campo conferma password dovrebbe essere una stringa.");

            if (!(request.body.password === request.body["conferma password"]))
                throw ("la conferma password e la password non coincidono");

            if (typeof request.body.email !== "string")
                throw ("il campo email dovrebbe essere una stringa.");

            if (request.body.email.length < 5)
                throw ("il campo email dovrebbe essere lungo almeno 5 caratteri.");

            if (request.body.email.length > 50)
                throw ("il campo email dovrebbe essere lungo al più 50 caratteri.");

            if (!request.body.email.match(EMAIL_REGEX))
                throw ("il campo email non contiene un email valida.");


            (await db.query(" WITH acc AS ( INSERT INTO Account(username, email, password, role) VALUES ( $1, $2, $3, 'cliente' ) RETURNING id ) INSERT INTO Clienti (id) SELECT id FROM acc ", [request.body.username, request.body.email, await encrypt(request.body.password)])).rows;
            response.status(200).send(`cliente ${request.body.username} creato.`);

        } catch (error) {
            if (error.severity && error.constraint === "clienti_username_key") {
                console.log(error);
                response.status(400).send(`email ${request.body.email} esiste gia'.`);
            } else {
                throw error;
            }
        }

    } catch (error) {
        console.error(error);
        response.status(400).send(error);
    }
});

router.post("/pro/create", async function(request, response, next) {
    try {
        try {

            if (request.user && request.user.role !== "admin")
                return response.status(401).send('Unauthorized');

            if (request.body.username === undefined)
                throw ("il campo username è obbligatorio.");
            if (request.body.email === undefined)
                throw ("il campo email è obbligatorio.");
            if (request.body.password === undefined)
                throw ("il campo password è obbligatorio.");

            if (typeof request.body !== "object" || Array.isArray(request.body))
                throw ("il campo body deve essere un oggetto.");

            if (typeof request.body.username !== "string")
                throw ("il campo username dovrebbe essere una stringa.");

            if (request.body.username.length < 1)
                throw ("il campo username dovrebbe essere lungo almeno 1 caratteri.");

            if (request.body.username.length > 50)
                throw ("il campo username dovrebbe essere lungo al più 50 caratteri.");

            if (typeof request.body.password !== "string")
                throw ("il campo password dovrebbe essere una stringa.");

            if (request.body.password.length > 50)
                throw ("il campo password dovrebbe essere lungo al più 50 caratteri.");

            if (typeof request.body["conferma password"] !== "string")
                throw ("il campo conferma password dovrebbe essere una stringa.");

            if (!(request.body.password === request.body["conferma password"]))
                throw ("la conferma password e la password non coincidono");

            if (typeof request.body.email !== "string")
                throw ("il campo email dovrebbe essere una stringa.");

            if (request.body.email.length < 5)
                throw ("il campo email dovrebbe essere lungo almeno 5 caratteri.");

            if (request.body.email.length > 50)
                throw ("il campo email dovrebbe essere lungo al più 50 caratteri.");

            if (!request.body.email.match(EMAIL_REGEX))
                throw ("il campo email non contiene un email valida.");


            (await db.query(" WITH acc AS ( INSERT INTO Account(username, email, password, role) VALUES ( $1, $2, $3, 'pro' ) RETURNING id ) INSERT INTO Pros(id) VALUES ( id FROM acc ); ", [request.body.username, request.body.email, await encrypt(request.body.password)])).rows;
            response.status(200).send(`pro ${request.body.username} creato.`);

        } catch (error) {
            if (error.severity && error.constraint === "clienti_username_key") {
                console.log(error);
                response.status(400).send(`email ${request.body.email} esiste gia'.`);
            } else {
                throw error;
            }
        }

    } catch (error) {
        console.error(error);
        response.status(400).send(error);
    }
});
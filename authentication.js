const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const db = require('./db');
const bcrypt = require('bcrypt');

passport.setLocalStrategy = function(modelName="users", usernameFields=["username"], passwordField="password", serializeField) {
  console.assert(Array.isArray(usernameFields) && usernameFields.length, "usernameFields must be a non empty array");

  serializeField = serializeField || usernameFields[0];

  passport.serializeUser(function(user, done) {
    done(null, user[serializeField]);
  });

  passport.deserializeUser(function(id, done) {
     db.query(`select * from ${modelName} where ${serializeField} = $1 LIMIT 1`, [id], function(err, result) {
        let user = result.rows[0];
        if(user)
          delete user[passwordField];
        done(err, user);
     });
  });

  const locale = require("./locale").getLocale();

  const or = locale.or();
  const incorrectUsernameError = locale.incorrectUsername(usernameFields.join(or));
  const incorrectPasswordError = locale.incorrectPassword();

  const queryText = `select * from ${modelName} where ` + usernameFields.map(field => field + " = $1").join(" OR ") + " LIMIT 1";

  passport.authenticateAsync = function(username, password, req) {
    return new Promise((resolve, reject) => {
      db.query(queryText, [username], function (err, result) {
        user = result.rows[0];
        if(user) {
          bcrypt.compare(password, user[passwordField], function(err, res) {
            if(res) {
              // Passwords match
              delete user[passwordField];
              req.logIn(user, function(err) {
                if (err) reject(err);
                else resolve(user);
              });
            } else {
              // Passwords don't match
              return reject(incorrectPasswordError);
            }
          });
        } else {
            // username Incorrect
            return reject(incorrectUsernameError);
          }
      })
      
    })
  }
}

passport.loginAsync = function(req, user) {
  return new Promise((resolve, reject) => {
    req.logIn(user, function(err) {
      if (err) return reject(err);
      return resolve(user);
    });
  })
}


module.exports = passport;

/*this.use(new LocalStrategy(
    function(username, password, done) {
      
      db.query(queryText, [username], function (err, result) {
        let user = result.rows[0];
        if (err)   return done(err);
        if (!user) return done(null, false, { message: 'Incorrect username.' });
        bcrypt.compare(password, user[passwordField], function(err, res) {
          if(res) {
            // Passwords match
            delete user[passwordField];
            return done(null, user);
          }
          // Passwords don't match
          return done(null, false, { message: 'Incorrect password.' }); 
        });
      });
    }
  ));*/

  /*passport.authenticateBodyAsync = function(req, res, next) {
  return new Promise((resolve, reject) => {
    passport.authenticate('local', function(err, user, info) {
        if (err)   return reject(err);
        if (!user) return reject(info);
        req.logIn(user, function(err) {
          if (err) return reject(err);
          return resolve(user);
        });
    })(req, res, next);
  })
}*/

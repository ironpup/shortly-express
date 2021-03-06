var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var cookieParse = require('cookie-parser');

// var sessions
// app.use(sessions())
var bCrypt = require('bcrypt-nodejs')
var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));

// for sessions
app.use(cookieParse({secret: 'secret code'}));

//////////////////////////////////////////
////////Helper Functions
/////////////////////////////////////////

var checkUser = function(req, res, next){
  // check our database, in table user
  new User({username: req.body.username})
    .fetch()    
    .then(function(model) {
      if (model) {      
        next(true);      
      } else {
        next(false);    
      }
    }); 
};

var hasher = function(password, next) {
  var hash = bCrypt.hash(password,null, null, function(err, hash) {    
    next(hash);
  })
}

var checkPassword = function(username, password, next) {
  hasher(password, function(hash) {
    //if the hash equal to username password
    // select password from users where username = username
    console.log("++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++")    
    console.log(username)
    new User({username : username})
      .fetch()
      .then(function(model) {
        bCrypt.compare(model.attributes.password, hash, function(err, res) {
          if (res) {
            next(true);                                          
          } else {
          next(false);         
        }
      })
    })
  });
}

app.get('/', function(req, res, next) {
  // check if cookie is a valid cookie
  console.log(req.cookies.remember)
  if (!req.cookies.remember) {  
    console.log("you don't have any cookies")
    next();
  } else {
    console.log("you do have cookies!")    
    res.writeHeader(302, {Location: '/'})          
    res.end();
  }
}, 
  function(req, res, next) {  
    res.writeHeader(302, {Location: '/login'})          
    res.end();
  }
);


app.get('/signup', function(req, res) {
  res.render('signup');
});

/////// Creating a new user
app.post('/signup', function(req, res) {    
    checkUser(req, res, function(userExists) {
      if (!userExists) {
        hasher(req.body.password, function(item) { 
          var newUser = new User({
            'username': req.body.username,
            'password': item
          }).save().then(function(body) {
            // initialize a new session 
            res.writeHeader(302, {Location: '/'})
            res.end();        
          });        
        })
      } else {
      /////// do something if the user already exists
      }
  });
});

/////////// Login
app.get('/login', function(req,res) {
  res.render('login');
});

app.post('/login',
  function(req, res) {
    checkUser(req, res, function(userExists) {
      if (userExists) { 
        checkPassword(req.body.username, req.body.password, function(passMatch) {
          if (passMatch) {
            console.log('starting a new session')
            // initialize a new session          
            res.writeHeader(302, {Location: '/'})
            res.end();
          } else {
            res.writeHeader(302, {Location: '/login'})          
            res.end();
          }
        })
      } else {
        res.writeHeader(302, {Location: '/login'});
        res.end();
      }
    })    
  }
);

app.get('/links', checkUser,
function(req, res) {
  Links.reset().fetch().then(function(links) {
    res.send(200, links.models);
  });
});

app.post('/links', checkUser,
function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.send(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.send(200, found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.send(404);
        }

        Links.create({
          url: uri,
          title: title,
          base_url: req.headers.origin
        })
        .then(function(newLink) {
          res.send(200, newLink);
        });
      });
    }
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/



/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        link_id: link.get('id')
      });

      click.save().then(function() {
        link.set('visits', link.get('visits')+1);
        link.save().then(function() {
          return res.redirect(link.get('url'));
        });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);

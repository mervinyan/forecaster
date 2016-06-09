var express = require('express');
var multer = require('multer');

var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var validator = require('express-validator');

var cashflow = require('./routes/cashflow');
var accounts = require('./routes/accounts');
var forecasts = require('./routes/forecasts');
var actuals = require('./routes/actuals');

var app = express();

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

var storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, './uploads');
  },
  filename: function(req, file, cb) {
    cb(null, "actuals.csv");
  }
});
app.use(multer({storage: storage}).single('actuals'));
// app.use(multer({dest: './uploads'}).single('actuals'));
app.use(validator())
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', cashflow);
app.use('/accounts', accounts);
app.use('/forecasts', forecasts);
app.use('/actuals', actuals);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function (err, req, res, next) {
    res.status(err.status || 500);
    res.render('error.pug', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function (err, req, res, next) {
  res.status(err.status || 500);
  res.render('error.pug', {
    message: err.message,
    error: {}
  });
});

app.listen(3200, function () {
  console.log('listening on port 3200!')
});

module.exports = app;

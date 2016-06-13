var express = require('express');
var router = express.Router();

var moment = require('moment');
var fs = require("fs");
var csv = require('fast-csv');

var numeral = require('numeral');

var utils = require('./utils.js');
var uuid = require('node-uuid');

router.get('/', function (req, res, next) {
    res.render('budgets.pug', { title: 'Budgets', 'data': [] });
    
});


module.exports = router;
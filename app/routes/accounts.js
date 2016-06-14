var express = require('express');
var router = express.Router();

var moment = require('moment');
var fs = require("fs");
var csv = require('fast-csv');

var numeral = require('numeral');

var utils = require('./utils.js');
var uuid = require('node-uuid');

router.get('/summary/:as_of_year?/:as_of_month?/:bank_id?', function (req, res, next) {
    req.checkParams('as_of_year', 'Year must be integer').optional().isInt();
    req.checkParams('as_of_month', 'Month must be integer').optional().isInt();
    // req.checkParams('bank_id', 'Month is required').optional();
    var errors = req.validationErrors()
    if (errors) {
        var err = new Error('Invalid value for year and/or month');
        err.status = 404;
        next(err);
    } else {
        var as_of_year = req.params.as_of_year;
        var as_of_month = req.params.as_of_month;
        if (!as_of_year && !as_of_month) {
            as_of_year = moment().year();
            as_of_month = moment().month() + 1;
            var as_of_date = moment();
            res.render('accounts.pug', { title: 'Accounts', 'as_of_year': as_of_year, 'as_of_month': as_of_month, 'as_of_date': as_of_date.format('YYYY-MMM-DD'), 'account_summary_list': [] });
        } else if (as_of_year && !as_of_month) {
            var err = new Error('Both year and month are rqeuired');
            err.status = 404;
            next(err);
        } else if (!as_of_year && as_of_month) {
            var err = new Error('Both year and month are rqeuired');
            err.status = 404;
            next(err);
        } else {
            if (parseInt(as_of_month) < 1) {
                as_of_month = 11;
                as_of_year = as_of_year - 1;
            }
            if (parseInt(as_of_month) > 12) {
                as_of_month = 1;
                as_of_year = as_of_year + 1;
            }
            var as_of_date = moment().year(as_of_year).month(parseInt(as_of_month) + 1).day(1).subtract(1, 'days');
            if (as_of_date > moment()) {
                as_of_date = moment();
            }
            res.render('accounts.pug', { title: 'Accounts', 'as_of_year': as_of_year, 'as_of_month': as_of_month, 'as_of_date': as_of_date.format('YYYY-MMM-DD'), 'account_summary_list': [] });
        }
    }

});


module.exports = router;
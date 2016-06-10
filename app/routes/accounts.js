var express = require('express');
var router = express.Router();

var moment = require('moment');
var fs = require("fs");
var csv = require('fast-csv');

var numeral = require('numeral');

var utils = require('./utils.js');
var uuid = require('node-uuid');

router.get('/', function (req, res, next) {
    res.render('accounts.pug', { title: 'Accounts' });
});

router.get('/fetch', function (req, res, next) {
    utils.fetch_projection_result('projection_account_info', 
        function (data) {
            var accounts = [];
            for (var account in data.accounts) {
                accounts.push(data.accounts[account]);
            }
            res.json({ 'data': accounts });
        },
        function () {
            res.json({ 'data': [] });
        },
        function () {
            res.json({ 'data': [] });
        });

});



router.post('/add', function (req, res, next) {
    utils.process(req, res,
        function (req) {
            req.checkBody('name', 'Name is required').notEmpty();
            req.checkBody('status', 'Status is required').notEmpty();
            req.checkBody('type', 'Type is required').notEmpty();

            var errors = req.validationErrors();
            return errors;

        },
        function (req) {
            return "account-" + req.body.name.toLowerCase().replace(/ /g, "_");
        },
        function (req) {

            var events = [];
            events.push(
                {
                    'EventId': uuid.v4(),
                    'Type': 'AccountCreated',
                    'Data': new Buffer(JSON.stringify({
                        'name': req.body.name,
                        'status': req.body.status,
                        'type': req.body.type,
                        'yield': req.body.yield,
                        'monthly_fee': req.body.monthly_fee,
                        'min_balance': req.body.min_balance,
                        'free_bill_pay': req.body.free_bill_pay,
                        'free_atm_use': req.body.free_atm_use,
                        'std_apr': req.body.std_apr,
                        'annual_fee': req.body.annual_fee,
                        'brand': req.body.brand,
                        'reward': req.body.reward,
                        'reward_rate': req.body.reward_rate,
                        'interest_rate': req.body.interest_rate,
                        'term': req.body.term,
                        'loan_amount': req.body.loan_amount,
                        'origination_date': req.body.origination_date,
                        'mortgage_type': req.body.mortgage_type,
                    })),
                    'IsJson': true
                }
            );

            return events;
        }
    );
});



module.exports = router;

var express = require('express');
var router = express.Router();

var moment = require('moment');

var numeral = require('numeral');

var utils = require('./utils.js');
var uuid = require('node-uuid');

router.get('/', function (req, res, next) {
    utils.fetch_projection_result('projection_account_info',
        function (data) {
            var accounts = [];
            for (var account in data.accounts) {
                if (data.accounts[account].status == "Active") {
                    accounts.push(account);
                }
            }
            res.render('forecasts.pug', { title: 'Forecasts', 'accounts': accounts });
        },
        function () {
            res.render('forecasts.pug', { title: 'Forecasts', 'accounts': [] });
        },
        function () {
            res.render('forecasts.pug', { title: 'Forecasts', 'accounts': [] });
        });
});

router.get('/fetch', function (req, res, next) {
    utils.fetch_events_backwards('forecasted_transactions', -1, 1000, true, function (readResult) {
        var forecasted_transactions = [];
        for (var i = 0; i < readResult.Events.length; i++) {
            var event = readResult.Events[i].Event;
            var eventDataStr = utils.bin2String(readResult.Events[i].Event.Data.toJSON().data)
            var eventData = JSON.parse(eventDataStr);
            var amount = numeral(eventData.amount).format('$0,0.00');
            if (event.EventType == 'IncomeForecastAdded') {
                forecasted_transactions[i] = { date: eventData.date, account: eventData.account, amount: amount, from: eventData.from, type: eventData.type, to: "", for: "", category: "" };
            } else if (event.EventType == 'ExpenseForecastAdded') {
                forecasted_transactions[i] = { date: eventData.date, account: eventData.account, amount: amount, to: eventData.to, for: eventData.for, category: eventData.category, from: "", type: "" };
            }
        }

        forecasted_transactions.sort(function(a, b) {
            if (moment(b.date).isAfter(moment(a.date))) {
                return 1;
            } else if (moment(b.date).isSame(moment(a.date))) {
                return 0;
            } else {
                return -1;
            }
        });

        res.json({ "data": forecasted_transactions });
    });
});

router.post('/add', function (req, res, next) {
    utils.process(req, res,
        function (req) {
            req.checkBody('date', 'Date is required').notEmpty().isDate();
            req.checkBody('account', 'Account is required').notEmpty();
            req.checkBody('amount', 'Amount is required').notEmpty().isDecimal();
            req.checkBody('type', 'Type is required').notEmpty();
            if (req.body.type == 'income') {
                req.checkBody('from', 'From is required').notEmpty();
                req.checkBody('income_type', 'Income Type is required').notEmpty();
            } else if (req.body.type == 'expense') {
                req.checkBody('to', 'To is required').notEmpty();
                // req.checkBody('for', 'For is required').notEmpty();
                req.checkBody('category', 'Category is required').notEmpty();
            }
            if (req.body.recurring == 'yes') {
                req.checkBody('frequency', 'Frequency is required').notEmpty();
                if (req.body.frequency == 'Semi-Monthly') {
                    if (moment(req.body.date).date() > 28) {

                    }
                }
                // req.checkBody('starts', 'Starts is required').notEmpty().isDate();
                req.checkBody('endOptions', 'endOptions is required').notEmpty();
                if (req.body.endOptions == 'after') {
                    req.checkBody('occurrences', 'Occurrences is required').notEmpty().isInt();
                } else if (req.body.endOptions == 'on') {
                    req.checkBody('ends', 'Ends is required').notEmpty().isDate();
                }
            }
            var errors = req.validationErrors();
            return errors;

        },
        function (req) {
            return "account-" + req.body.account.toLowerCase().replace(/ /g, "_");
        },
        function (req) {
            var dates = [];
            var start = moment(req.body.date);
            if (req.body.recurring == 'yes') {
                var step = 0;
                var unit = '';
                if (req.body.frequency == 'Bi-Weekly') {
                    step = 14;
                    unit = 'days';
                }
                if (req.body.frequency == 'Semi-Monthly') {
                    step = 15;
                    unit = 'days';
                }
                if (req.body.frequency == 'Monthly') {
                    step = 1;
                    unit = 'months';
                }
                if (req.body.frequency == 'Yearly') {
                    step = 1;
                    unit = 'years';
                }

                if (req.body.endOptions == 'after') {
                    var count = parseInt(req.body.occurrences);
                    dates = utils.calculate_dates(start, count, step, unit);
                } else if (req.body.endOptions == 'on') {
                    dates = utils.calculate_dates_until(start, moment(req.body.ends), step, unit);
                }
            } else {
                dates.push(start);
            }

            // console.log(dates);
            var eventType = "";
            if (req.body.type == 'income') {
                eventType = "IncomeForecastAdded";
            } else {
                eventType = "ExpenseForecastAdded";
            }
            var events = [];
            for (var i = 0; i < dates.length; i++) {
                var eventData = {};
                if (req.body.type == 'income') {
                    eventData = {
                        'account': req.body.account,
                        'from': req.body.from,
                        'amount': req.body.amount,
                        'type': req.body.type,
                        'date': dates[i].format('YYYY-MM-DD')
                    };
                } else {
                    eventData = {
                        'account': req.body.account,
                        'to': req.body.to,
                        'for': req.body.for,
                        'amount': req.body.amount,
                        'category': req.body.category,
                        'date': dates[i].format('YYYY-MM-DD')
                    };
                }
                events.push(
                    {
                        'EventId': uuid.v4(),
                        'Type': eventType,
                        'Data': new Buffer(JSON.stringify(eventData)),
                        'IsJson': true
                    }
                );
            }

            return events;
        }
    );
});


module.exports = router;

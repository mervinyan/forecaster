var express = require('express');
var router = express.Router();

var moment = require('moment');
var fs = require("fs");
var csv = require('fast-csv');

var numeral = require('numeral');


var utils = require('./utils.js');
var uuid = require('node-uuid');

router.get('/', function (req, res, next) {
    res.render('actuals.pug', { title: 'Actuals' });
});


router.get('/fetch', function (req, res, next) {
    utils.fetch_events_backwards('actual_transactions-2016', -1, 4096, true, function (readResult) {
        var actual_transactions = [];
        for (var i = 0; i < readResult.Events.length; i++) {
            var event = readResult.Events[i].Event;
            var eventDataStr = bin2String(event.Data.toJSON().data)
            var eventData = JSON.parse(eventDataStr);
            var amount = numeral(eventData["Amount"]).format('$0,0.00');
            var transaction = {
                "date": eventData["Date"],
                "account": eventData["Account Name"],
                "amount": amount,
                "transaction_type": eventData["Transaction Type"],
                "description": eventData["Description"],
                "original_description": eventData["Original Description"],
                "category": eventData["Category"],
                "labels": eventData["Labels"],
                "notes": eventData["Notes"]
            };
            actual_transactions.unshift(transaction);
        }
        res.json({ "data": actual_transactions });
    });
});

router.post('/import', function (req, res, next) {
    console.log(req.files);
    var account_name_lookup = {};
    utils.fetch_projection_result('projection_account_name_lookup',
        function (data) {

            for (var account in data.accounts) {
                if (!account_name_lookup[account]) {
                    account_name_lookup[account] = data.accounts[account];
                }
            }
        },
        function () {
            res.json({ 'data': [] });
        },
        function () {
            res.json({ 'data': [] });
        });


    var stream = fs.createReadStream("./uploads/actuals.csv");
    var events = {};
    csv.fromStream(stream, { headers: true })
        .on("data", function (data) {
            var accountName = data["Account Name"];
            if (!events[accountName]) {
                events[accountName] = [];
            }
            events[accountName].unshift({
                EventId: uuid.v4(),
                Type: 'ActualImported',
                Data: new Buffer(JSON.stringify(data)),
                IsJson: true
            });
        })
        .on("end", function () {
            console.log("done");
            for (var accountName in events) {
                utils.process(req, res,
                    function (req) {
                        var errors = req.validationErrors();
                        return errors;
                    },
                    function (req) {
                        if (account_name_lookup[accountName]) {
                            return "account-" + account_name_lookup[accountName].toLowerCase().replace(/ /g, "_");
                        } else {
                            return "account-" + accountName.toLowerCase().replace(/ /g, "_");

                        }
                    },
                    function (req) {
                        return events[accountName];
                    }
                );
            }
        });
});


module.exports = router;

var express = require('express');
var router = express.Router();

var moment = require('moment');
var fs = require("fs");
var csv = require('fast-csv');

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
            res.render('actuals.pug', { title: 'Transactions', 'accounts': accounts });
        },
        function () {
            res.render('actuals.pug', { title: 'Transactions', 'accounts': [] });
        },
        function () {
            res.render('actuals.pug', { title: 'Transactions', 'accounts': [] });
        });
});


router.get('/fetch', function (req, res, next) {
    utils.fetch_events_backwards('actual_transactions-2016', -1, 4096, true, function (readResult) {
        var actual_transactions = [];
        for (var i = 0; i < readResult.Events.length; i++) {
            var event = readResult.Events[i].Event;
            var eventDataStr = utils.bin2String(event.Data.toJSON().data)
            var eventData = JSON.parse(eventDataStr);
            var amount = numeral(eventData["amount"]).format('$0,0.00');
            var transaction = {
                "date": eventData["date"],
                "account": eventData["account"],
                "amount": amount,
                "transaction_type": eventData["transaction_type"],
                "description": eventData["description"],
                "original_description": eventData["original_description"],
                "category": eventData["category"],
                "labels": eventData["labels"],
                "notes": eventData["notes"]
            };
            actual_transactions.push(transaction);
        }
        res.json({ "data": actual_transactions });
    });
});

router.post('/import', function (req, res, next) {
    console.log(req.files);
    var accountName = req.body.account_name;

    var stream = fs.createReadStream("./uploads/actuals.csv");
    var events = [];
    csv.fromStream(stream, { headers: true })
        .on("data", function (data) {
            var eventData = {
                "date": moment(data["Date"]).format('YYYY-MM-DD'),
                "account": accountName,
                "amount": data["Amount"],
                "transaction_type": data["Transaction Type"],
                "description": data["Description"],
                "original_description": data["Original Description"],
                "category": data["Category"],
                "labels": data["Labels"],
                "notes": data["Notes"]
            };
            events.unshift({
                EventId: uuid.v4(),
                Type: 'ActualImported',
                Data: new Buffer(JSON.stringify(eventData)),
                IsJson: true
            });
        })
        .on("end", function () {
            console.log("done");
            utils.process(req, res,
                function (req) {
                    var errors = req.validationErrors();
                    return errors;
                },
                function (req) {
                    return "account-" + accountName.toLowerCase().replace(/ /g, "_");
                },
                function (req) {
                    return events;
                }
            );
        });
});


module.exports = router;

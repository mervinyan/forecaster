var express = require('express');
var router = express.Router();

var http = require('http');

var ges = require('ges-client');
var uuid = require('node-uuid');

var moment = require('moment');
var fs = require("fs");
var csv = require('fast-csv');

var numeral = require('numeral');

router.get('/', function (req, res, next) {
    res.render('actuals.pug', { title: 'Actuals' });
});

router.get('/fetch', function (req, res, next) {
    fetch_events_backwards('actual_transactions-2016', -1, 4096, true, function (readResult) {
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

    var options1 = {
        host: 'localhost',
        port: 2113,
        path: '/projection/projection_account_name_lookup/result',
        method: 'GET'
    }

    http.request(options1, function (res1) {
        if (res1.statusCode == 200) {
            res1.setEncoding('utf8');
            var body = "";
            res1.on('data', function (chunk) {
                body += chunk;
            });
            res1.on('end', function () {
                if (body.trim().length > 0) {
                    var data = JSON.parse(body);
                    for (var account in data.accounts) {
                        if (!account_name_lookup[account]) {
                            account_name_lookup[account] = data.accounts[account];
                        }
                    }
                } else {
                }

            });
        } else {
        }
    }).end();

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
                process(req, res,
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

function fetch_events_backwards(stream, start, count, resolveLinkTos, resultProcessor) {
    var connection = ges({ host: '127.0.0.1' });
    connection.on('connect', function () {
        console.log('connecting to geteventstore...');
        connection.readStreamEventsBackward(stream, { start: start, count: count, resolveLinkTos: resolveLinkTos }, function (err, readResult) {
            if (err) return console.log('Ooops!', err);
            resultProcessor(readResult);
        });
    });
}

function process(req, res, requestValidator, streamIdGenerator, eventDataExtractor) {
    var errors = requestValidator(req);
    if (errors) {
        res.json({ flash: { type: 'alert-danger', messages: errors } });
    } else {
        var stream = streamIdGenerator(req);
        var events = eventDataExtractor(req);
        append_events_to_stream(stream, events, function (appendResult) {
            res.json(appendResult);
        })
    }
}

function append_events_to_stream(stream, events, callback) {
    var connection = ges({ host: '127.0.0.1' });
    connection.on('connect', function () {
        console.log('connecting to geteventstore...');
        connection.readStreamEventsBackward(stream, { start: -1, count: 1, resolveLinkTos: true }, function (err, readResult) {
            if (err) return console.log('Ooops!', err);
            var expectedVersion = readResult.LastEventNumber;
            var appendData = {
                expectedVersion: expectedVersion,
                events: events
            };
            connection.appendToStream(stream, appendData, function (err, appendResult) {
                if (err) return console.log('Oops!', err);
                callback(appendResult);
            });

        });
    });
}

function bin2String(array) {
    var result = "";
    for (var i = 0; i < array.length; i++) {
        result += String.fromCharCode(array[i]);
    }
    return result;
}

function sort_by_date(a, b) {
    return b.date.localeCompare(a.date);
}


module.exports = router;

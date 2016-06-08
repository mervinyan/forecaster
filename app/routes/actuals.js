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
    res.render('actuals.pug', { title: 'Actuals'});
});

router.get('/fetch', function (req, res, next) {
    fetch_events_backwards('actuals', -1, 1000, true, function (readResult) {
        // var forecasted_transactions = [];
        // for (var i = 0; i < readResult.Events.length; i++) {
        //     var event = readResult.Events[i].Event;
        //     var eventDataStr = bin2String(readResult.Events[i].Event.Data.toJSON().data)
        //     var eventData = JSON.parse(eventDataStr);
        //     var amount = numeral(eventData.amount).format('$0,0.00');
        //     if (event.EventType == 'IncomeForecastAdded') {
        //         forecasted_transactions[i] = { date: eventData.date, account: eventData.account, amount: amount, from: eventData.from, type: eventData.type, to: "", for: "", category: "" };
        //     } else if (event.EventType =='ExpenseForecastAdded') {
        //         forecasted_transactions[i] = { date: eventData.date, account: eventData.account, amount: amount, to: eventData.to, for: eventData.for, category: eventData.category, from: "", type: "" };
        //     }
        // }
        
        // forecasted_transactions.sort(sort_by_date);

        res.json({ "data": [] });
    });
});

router.post('/import', function (req, res, next) {
    console.log(req.files);

    var stream = fs.createReadStream("./uploads/transactions.csv");
    var events = [];
    csv.fromStream(stream, { headers: true })
        .on("data", function (data) {
            events.unshift({
                EventId: uuid.v4(),
                Type: 'ActualImported',
                Data: new Buffer(JSON.stringify(data)),
                IsJson: true
            });
        })
        .on("end", function () {
            console.log("done");
            var connection = ges({ host: '127.0.0.1' });
            connection.on('connect', function () {
                console.log('connecting to geteventstore...');
                var streamId = 'transactionstream-' + uuid.v4();
                connection.readStreamEventsBackward(streamId, { start: -1, count: 1, resolveLinkTos: true }, function (err, readResult) {
                    if (err) return console.log('Ooops!', err);
                    var expectedVersion = readResult.LastEventNumber;
                    var appendData = {
                        expectedVersion: expectedVersion,
                        events: events
                    };
                    connection.appendToStream(streamId, appendData, function (err, appendResult) {
                        if (err) return console.log('Oops!', err);
                        res.json(appendResult);
                    });

                });
            });
        });
});



function fetch_events_backwards(stream, start, count, resolveLinkTos, resultProcessor) {
    console.log(resolveLinkTos);
    var connection = ges({ host: '127.0.0.1' });
    connection.on('connect', function () {
        console.log('connecting to geteventstore...');
        connection.readStreamEventsBackward(stream, { start: start, count: count, resolveLinkTos: resolveLinkTos }, function (err, readResult) {
            if (err) return console.log('Ooops!', err);
            console.log(readResult);
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
        console.log(events);
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
            console.log(appendData);
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

function calculate_dates(start, count, step, unit) {
    var dates = [];
    dates.push(moment(start));
    if (step < 15) {
        for (var i = 1; i < count; i++) {
            dates.push(moment(start).add(step * (i), unit));
        }
    } else {
        if (moment(start).date() <= 13) {
            for (var i = 1; i < count; i++) {
                if (i % 2 == 0) {
                    dates.push(moment(start).add(Math.floor(i / 2), 'months'));
                } else {
                    dates.push(moment(start).add(Math.floor(i / 2), 'months').add(15, 'days'));
                }
            }
        } else {
            for (var i = 1; i < count; i++) {
                if (i % 2 == 1) {
                    if (moment(start).date() <= 15) {
                        dates.push(moment(start).add(Math.floor((i + 1) / 2), 'months').subtract((moment(start).date() - 1), 'days'));
                    } else {
                        dates.push(moment(start).add(Math.floor((i + 1) / 2), 'months').subtract(15, 'days'));
                    }
                } else {
                    dates.push(moment(start).add(Math.floor((i + 1) / 2), 'months'));
                }
            }
        }
    }

    return dates;
}

function calculate_dates_until(start, end, step, unit) {
    var dates = [];
    dates.push(moment(start));
    if (step < 15) {
        var i = 1;
        while (moment(start).add(step * (i), unit) <= moment(end)) {
            dates.push(moment(start).add(step * (i), unit));
            i++;
        }
    } else {
        if (moment(start).date() <= 13) {
            var i = 1;
            var next_date = (i % 2 == 0) ? moment(start).add(Math.floor(i / 2), 'months') : moment(start).add(Math.floor(i / 2), 'months').add(15, 'days');
            while (next_date < moment(end)) {
                dates.push(moment(next_date));
                i++;
                next_date = (i % 2 == 0) ? moment(start).add(Math.floor(i / 2), 'months') : moment(start).add(Math.floor(i / 2), 'months').add(15, 'days');
            }
        } else {
            var i = 1;
            var next_date = (i % 2 == 0) ? moment(start).add(Math.floor((i + 1) / 2), 'months') : (moment(start).date() <= 15 ? moment(start).add(Math.floor((i + 1) / 2), 'months').subtract((moment(start).date() - 1), 'days') : moment(start).add(Math.floor((i + 1) / 2), 'months').subtract(15, 'days'));
            while (next_date < moment(end)) {
                dates.push(moment(next_date));
                i++;
                next_date = (i % 2 == 0) ? moment(start).add(Math.floor((i + 1) / 2), 'months') : (moment(start).date() <= 15 ? moment(start).add(Math.floor((i + 1) / 2), 'months').subtract((moment(start).date() - 1), 'days') : moment(start).add(Math.floor((i + 1) / 2), 'months').subtract(15, 'days'));
            }
        }
    }

    return dates;
}


module.exports = router;

var express = require('express');
var router = express.Router();

var http = require('http');

var numeral = require('numeral');

router.get('/', function (req, res, next) {

    var options1 = {
        host: 'localhost',
        port: 2113,
        path: '/projection/projection_cashflow/result',
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
            var cashflow = [];
            if (body.trim().length > 0) {
                var data = JSON.parse(body);
                for (var month in data.cashflow) {
                    var cashflow_accounts = [];
                    for (var account in data.cashflow[month]) {
                        var cashflow_account = {
                            "account": account,
                            "begin": numeral(data.cashflow[month][account].begin).format('$0,0.00'),
                            "in": numeral(data.cashflow[month][account].in).format('$0,0.00'),
                            "out": numeral(data.cashflow[month][account].out).format('$0,0.00'),
                            "end": numeral(data.cashflow[month][account].end).format('$0,0.00')
                        };
                        cashflow_accounts.push(cashflow_account);
                        cashflow_accounts.sort(function (a, b) {
                            return a.account.localeCompare(b.account);
                        });
                    }
                    cashflow.push({ "month": month, "accounts": cashflow_accounts });
                }

                cashflow.sort(function (a, b) {
                    return a.month.localeCompare(b.month);
                });

                console.log(cashflow);
            } 

            res.render('cashflow.pug', { title: 'Cashflow Forecast', 'cashflow': cashflow });
        });
        } else {
            res.render('cashflow.pug', { title: 'Cashflow Forecast', 'cashflow': [] });
        }
        
    }).end();
});


module.exports = router;

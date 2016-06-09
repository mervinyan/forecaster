fromCategory('account')
    .when({
        $init: function () {
            return {
                balances: {}
            }
        },
        "ActualImported": function (state, ev) {
            if (!state.balances[ev.body["Account Name"]]) {
                state.balances[ev.body["Account Name"]] = 0.00;
            }
            if (ev.body["Transaction Type"] == "credit") {
                state.balances[ev.body["Account Name"]] += parseFloat(ev.body.Amount);
            }
            if (ev.body["Transaction Type"] == "debit") {
                state.balances[ev.body["Account Name"]] -= parseFloat(ev.body.Amount);
            }
        }
    });

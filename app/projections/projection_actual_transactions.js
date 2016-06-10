fromCategory('account')
    .foreachStream()
    .when({
        "ActualImported": function(state, ev) {
            var date =ev.body["Date"];
            var year = date.substring(0, 4);
            linkTo('actual_transactions-'+year, ev);
        }
    }
)
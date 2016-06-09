fromCategory('account')
    .foreachStream()
    .when({
        "ActualImported": function(state, ev) {
            var date =ev.body["Date"];
            var year = date.substring(date.lastIndexOf("/")+1, date.length);
            linkTo('actual_transactions-'+year, ev);
        }
    }
)
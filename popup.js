var server = "jira.yelpcorp.com";

var api_url = "https://"+server+"/rest/api/2";
var search_url = api_url + "/search";

function withinOneWorkDay(utfGivenTime){
  var givenTime = new Date(Date.parse(utfGivenTime)).getTime();
  var currentDateTime = new Date(Date.now());
  var timeBetweenLastStatusAndNextStatus = (currentDateTime.getDay() == 1) ?  24*60*60*3*1000 : 24*60*60*1000;
  var todaysStatusTime = new Date(currentDateTime.getFullYear(), currentDateTime.getMonth(), currentDateTime.getDate(), 10, 30, 0, 0);
  
  var lastStatusTime = todaysStatusTime.getTime() - timeBetweenLastStatusAndNextStatus;

  return givenTime > lastStatusTime;
}

function Issue(issue_obj){
  this.summary = issue_obj.fields.summary;
  this.key = issue_obj.key;
  this.link = "https://"+server+"/browse/"+this.key;
  this.status = issue_obj.fields.status.name;
  this.histories = create_history_array(issue_obj.changelog.histories);
  this.matched_rules = match_rules(this.histories);
}
Issue.prototype.createTextForRule = function(rule){
  //name e.g. Started Ticket
  return $('<p>'+rule+': '+this.summary+'(<a href="'+this.link+'">'+this.key+'</a>)</p>');
};



var relavant_fields = ["status"];
function create_history_array(history_obj_array){
  var result = [];
  history_obj_array.forEach(function(history_obj){
    if(withinOneWorkDay(history_obj.created)){
      result.push(new History(history_obj));
    }
  });
  return result;
}

function History(history_obj){
  this.created = history_obj.created;
  this.items = [];
  for(var i in history_obj.items){
    var item = history_obj.items[i];
    if(relavant_fields.indexOf(item.field) > -1){
      this.items.push(new FieldHistory(item));
    }
  }
}

function FieldHistory(item){
  this.field = item.field;
  this.from = item.fromString;
  this.to = item.toString;
}
FieldHistory.prototype.matches_rule = function(rule){
  return this.field == rule.field && this.from == rule.from && this.to == rule.to;
};

var RULES = [
  {
    name: "Started Ticket",
    field: "status",
    from: "Open",
    to: "In Progress"
  }
];
function match_rules(history_array){
  var result = [];
  history_array.forEach(function(history){
    history.items.forEach(function(field_history){
      for(var i in RULES){
        var rule = RULES[i];
        if(field_history.matches_rule(rule)){
          result.push(rule.name);
        }
      }
    });
  });
  return result;
}

document.addEventListener('DOMContentLoaded', function() {
  var submitButton = document.getElementById('submit');
  submitButton.addEventListener('mouseup', function() {
    var username = document.getElementById('username').value.trim();
    var password = document.getElementById('password').value.trim();

    var encoded = btoa(username + ':' + password);

    var query = {
      "jql": 'project = RX AND assignee in ("'+username+'") AND status in ("In Progress", "In Review", "Ready to Push")',
      "startAt": 0,
      "maxResults": 15,
      "fields": [
          "summary",
          "status",
          "assignee"
      ],
      "expand": [
        "changelog"
      ]
    };

    $.ajax({
      url: search_url,
      type: 'POST',
      data: JSON.stringify(query),
      dataType:'json',
      headers: {
        'Authorization': 'Basic '+encoded,
        'Content-Type': 'application/json'
      },
      success: function(data){
        console.log(data);
        if(data.total>0){
          var new_body = $('<div></div>');
          var issues = [];
          data.issues.forEach(function(issue_obj){
            issues.push(new Issue(issue_obj));
          });
          issues.forEach(function(issue){
            if(issue.matched_rules){
              for(var i in issue.matched_rules){
                var matched_rule = issue.matched_rules[i];
                new_body.append(issue.createTextForRule(matched_rule));
              }
            }
          });
          replace_body(new_body);
        } else {
          //no tickets in progress, in review, or ready to push
        }
      }
    });
  });
});

function replace_body(data){
  $('body').html(data);
}


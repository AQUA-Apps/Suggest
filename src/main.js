angular.module('AQUA Apps', ['ngMaterial', 'ngSanitize'])
.config(function($mdThemingProvider) {
    $mdThemingProvider.theme('default')
        .primaryPalette('blue')
        .accentPalette('orange');
}).controller('SiteCtrl', function($scope, $mdDialog, $mdMedia, $mdToast) {
    globalScope = $scope;

    $scope.showUserError = function() { $mdToast.show($mdToast.simple().textContent("You must be signed in to do this").action('SIGN IN').highlightAction(true)).then(function(response) { if (response == 'ok') signin(); }); };

    $scope.showToast = function(message) { $mdToast.show($mdToast.simple().textContent(message)); };

    $scope.showNew = function(ev) {
        var confirm = $mdDialog.prompt()
            .title('What would you like to suggest?')
            .placeholder('Suggestion')
            .ariaLabel('Suggestion')
            .targetEvent(ev)
            .ok('Submit')
            .clickOutsideToClose(true)
            .cancel('Cancel');

        $mdDialog.show(confirm).then(function(result) {
            if (!result) $scope.showToast("Suggestion is empty!");
            else addSuggestion(result);
        });
    };
});

function DialogController($scope, $mdDialog) {
    $scope.hide = function() { $mdDialog.hide(); };
    $scope.cancel = function() { $mdDialog.cancel(); };
    $scope.answer = function(answer) { $mdDialog.hide(answer); };
}

var globalScope;

var curUser, userVotes;
function signin() {
    firebase.auth().signInWithRedirect(new firebase.auth.GoogleAuthProvider());
}

function checkUser() {
    firebase.auth().onAuthStateChanged(function(user) {
        if (user) signedInWith(user);
        else checkRedirect();
    });
}

function checkRedirect() {
    firebase.auth().getRedirectResult().then(function(result) {
        if (result.user) signedInWith(result.user);
        else getSuggestions();
    }).catch(function(error) { getSuggestions() });
}

function signedInWith(user) {
    curUser = user;

    document.getElementById("btn-signin").style.display = "none";
    document.getElementById("btn-signout").style.display = "block";
    document.getElementById("userDp").src = user.photoURL;
    document.getElementById("userName").innerHTML = user.displayName;
    document.getElementById("userEmail").innerHTML = user.email;

    getUserVotes();
    getSuggestions();
}

function signout() {
    firebase.auth().signOut().then(function() {
        curUser = null;
        userVotes = {};

        document.getElementById("btn-signout").style.display = "none";
        document.getElementById("btn-signin").style.display = "block";
        document.getElementById("userDp").src = "images/ic-dp.png";
        document.getElementById("userName").innerHTML = "Not Signed In";
        document.getElementById("userEmail").innerHTML = "support@aquaapps.co";
    }, function(error) { globalScope.showToast("Sign out failed"); });
}

checkUser();

var allSuggestions = {}, suggestionPos = {}, selectedApp = "co_aquaapps_huddle", suggestionsRef, approvedSuggestionsRef, table, pos;
function getSuggestions() {
    pos = 0;
    table = document.getElementById("table-suggestions");
    table.innerHTML = "";

    allSuggestions = {}, suggestionPos = {};
    if (suggestionsRef) {
        suggestionsRef.off("child_added");
        suggestionsRef.off("child_changed");
        suggestionsRef.off("child_removed");
    }
    if (approvedSuggestionsRef) {
        approvedSuggestionsRef.off("child_added");
        approvedSuggestionsRef.off("child_changed");
        approvedSuggestionsRef.off("child_removed");
    }

    suggestionsRef = firebase.database().ref("suggestions/" + selectedApp).orderByChild("voteCount").limitToFirst(200);
    approvedSuggestionsRef = firebase.database().ref("approved_suggestions/" + selectedApp).orderByChild("voteCount").limitToFirst(200);
    suggestionsRef.on("child_added", onSuggestionAdded);
    approvedSuggestionsRef.on("child_added", onSuggestionAdded);

    suggestionsRef.on("child_changed", onSuggestionChanged);
    approvedSuggestionsRef.on("child_changed", onSuggestionChanged);

    suggestionsRef.on("child_removed", onSuggestionRemoved);
    approvedSuggestionsRef.on("child_removed", onSuggestionRemoved);
}

function onSuggestionAdded(data) {
    var suggestion = data.val();
    allSuggestions[data.key] = data.val();
    suggestionPos[data.key] = pos;

    var userVoted = false;
    if (firebase.auth().currentUser) userVoted = userVotes[data.key];

    var row = table.insertRow(pos++);
    var cellVoteButton = row.insertCell(0), cellVotes = row.insertCell(1), cellSuggestion = row.insertCell(2), cellCreated = row.insertCell(3), voteButton = document.createElement("button"), voteIcon = document.createElement("i");
    voteButton.className = "mdl-button mdl-js-button mdl-js-ripple-effect mdl-button--icon";
    voteIcon.className = "material-icons";
    voteIcon.innerHTML = "keyboard_arrow_up";
    if (userVoted) voteIcon.style.color = "#8BC34A";
    voteButton.appendChild(voteIcon);
    cellVoteButton.appendChild(voteButton);
    voteButton.onclick = function() {
        if (firebase.auth().currentUser) {
            vote(data.key);
            voteIcon.style.color = userVoted ? "#000000" : "#8BC34A";
            userVoted = !userVoted;
        } else globalScope.showUserError();
    };

    cellVotes.id = "cell-votes-" + (pos - 1);
    cellSuggestion.id = "cell-suggestion-" + (pos - 1);
    cellCreated.id = "cell-created-" + (pos - 1);
    cellVotes.innerHTML = -suggestion.voteCount - 1;
    cellSuggestion.innerHTML = suggestion.suggestion;
    cellCreated.innerHTML = suggestion.created;

    cellVotes.className = cellSuggestion.className = cellCreated.className = "mdl-data-table__cell--non-numeric";
}

function onSuggestionChanged(data) {
    allSuggestions[data.key] = data.val();
    document.getElementById("cell-votes-" + suggestionPos[data.key]).innerHTML = -data.val().voteCount - 1;
    document.getElementById("cell-suggestion-" + suggestionPos[data.key]).innerHTML = data.val().suggestion;
    document.getElementById("cell-created-" + suggestionPos[data.key]).innerHTML = data.val().created;
}

function onSuggestionRemoved(data) {
    var rowPos = suggestionPos[data.key];
    table.deleteRow(rowPos);
    for (key in suggestionPos)
        if (suggestionPos[key] > rowPos)
            suggestionPos[key] -= 1;
    delete suggestionPos[data.key];
    pos--;
}

function newSuggestion() {
    if (!firebase.auth().currentUser) globalScope.showUserError();
    else globalScope.showNew();
}

function addSuggestion(suggestionText) {
    var suggestion = { created: moment().format("DD MMM YYYY"), voteCount: -1, suggestion: suggestionText }, updates = {}, approvedUpdates = {};
    var newSuggestionKey = firebase.database().ref().child('suggestions/' + selectedApp).push().key;
    updates["/suggestions/" + selectedApp + "/" + newSuggestionKey] = suggestion;
    approvedUpdates["/approved_suggestions/" + selectedApp + "/" + newSuggestionKey] = suggestion;
    updates["/users/" + firebase.auth().currentUser.uid + "/" + selectedApp + "/" + newSuggestionKey] = true;
    userVotes[newSuggestionKey] = true;
    firebase.database().ref().update(updates);
    firebase.database().ref().update(approvedUpdates);
    globalScope.showToast("Thank you. Your suggestion will be available for voting once approved");
}

function vote(key) {
    var userVoted = userVotes[key], updates = {}, approvedUpdates = {};
    allSuggestions[key].voteCount += (userVoted ? 1 : -1);
    updates["/suggestions/" + selectedApp + "/" + key + "/voteCount"] = allSuggestions[key].voteCount;
    updates["/approved_suggestions/" + selectedApp + "/" + key + "/voteCount"] = allSuggestions[key].voteCount;
    approvedUpdates["/approved_suggestions/" + selectedApp + "/" + key] = allSuggestions[key];
    updates["/users/" + firebase.auth().currentUser.uid + "/" + selectedApp + "/" + key] = !userVoted;
    firebase.database().ref().update(updates);
    firebase.database().ref().update(approvedUpdates);
}

function getUserVotes() {
    var user = firebase.auth().currentUser;
    if (!user) return;
    userVotes = {};
    var userVotesRef = firebase.database().ref("users/" + user.uid + "/" + selectedApp);
    userVotesRef.on("child_added", function(data) { userVotes[data.key] = data.val(); });
    userVotesRef.on("child_changed", function(data) { userVotes[data.key] = data.val(); });
}

function setApp(appLink, appPackage) {
    var allNavs = document.getElementsByClassName("mdl-navigation__link");
    for (var i = 0; i < allNavs.length; i++) allNavs[i].className = allNavs[i].className.replace("active", "");
    appLink.className = appLink.className + " active";

    selectedApp = appPackage;
    getUserVotes();
    getSuggestions();

    ga('send', 'event', 'App', 'click', appPackage);
}

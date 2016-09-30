(function() {
    angular.module('apps').controller('AppController', [ 'appService', AppController ]);

    function AppController(appService) {
        var self = this;

        self.selected = null;
        self.apps = [];
        self.selectApp = selectApp;

        appService.loadAllApps().then(function(apps) {
            self.apps = [].concat(apps);
            self.selected = apps[0];
        });

        function selectApp(app) {
            // TODO Change
            self.selected = angular.isNumber(app) ? $scope.apps[app] : app;
        }
    }
})();

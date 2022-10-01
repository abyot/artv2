'use strict';

/* App Module */

var art = angular.module('art',
        ['ui.bootstrap',
         'ngRoute',
         'ngCookies',
         'ngSanitize',
         'ngMessages',
         'artSummaryServices',
         'artFilters',
         'artDirectives',
         'artControllers',
         'd2Directives',
         'd2Filters',
         'd2Services',
         'd2Controllers',
         'angularLocalStorage',
         'ui.select',
         'ui.select2',
         //'ngCsv',
         'pascalprecht.translate'])

.value('DHIS2URL', '../api')

.value('API_DATE_FORMAT', 'yyyy-mm-dd')

.config(function($httpProvider, $routeProvider, $translateProvider) {

    $httpProvider.defaults.useXDomain = true;
    delete $httpProvider.defaults.headers.common['X-Requested-With'];

    $routeProvider.when('/home', {
        templateUrl:'components/home/home.html',
        controller: 'HomeController'
    }).otherwise({
        redirectTo : '/home'
    });

    $translateProvider.preferredLanguage('en');
    $translateProvider.useSanitizeValueStrategy('escaped');
    $translateProvider.useLoader('i18nLoader');
})

.run(function($rootScope){
    $rootScope.maxOptionSize = 1000;
});

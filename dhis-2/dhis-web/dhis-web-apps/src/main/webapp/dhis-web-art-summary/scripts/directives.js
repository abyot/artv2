/* global directive, selection, dhis2, angular */

'use strict';

/* Directives */

var artSummaryDirectives = angular.module('artSummaryDirectives', [])

.directive('d2Blur', function () {
    return function (scope, elem, attrs) {
        elem.change(function () {
            scope.$apply(attrs.d2Blur);
        });
    };
})

.directive('fileUpload', function($parse, $timeout) {
    return {
        restrict: 'A',
        link: function(scope, element, attrs) {
            var model = $parse(attrs.fileUpload);
            var modelSetter = model.assign;

            element.bind('change', function(event) {
                scope.$apply(function() {
                    modelSetter(scope, element[0].files);
                });
                event.preventDefault();
            });
        }
    };
})

.directive('equalHeightNavTabs', function ($timeout) {
    return function (scope, element, attrs) {
        $timeout(function () {
            var tabMenus = '.nav.nav-tabs.nav-justified';
            $(tabMenus).each(function(){
                $(this).addClass('hideInPrint');
            });

            var highest = 0;
            var selector = '.nav-tabs.nav-justified > li > a';
            $(selector).each(function(){
                var h = $(this).height();
                if(h > highest){
                   highest = $(this).height();
                }
            });
            if( highest > 0 ){
                $(".nav-tabs.nav-justified > li > a").height(highest);
            }
        });
    };
})

/*.directive('dhis2Dashboard', function ($translate, $timeout, $compile) {
    return {
        restrict: 'EA',
        scope: {
            dashboard: "=",
            downloadlabel: "=",
            charts: "=",
            tables: "=",
            maps: "="
        },
        template: '<div id="dashboardItemContainer"></div>',
        link: function (scope, element, attrs) {

            var base = "..";

            var $div = $("#dashboardItemContainer");

            $div.empty();

            var chartItems = [], tableItems = [], mapItems = [];

            $.each(scope.dashboard, function (i, item) {

                //$div.append('<div class="dashboard-item-container vertical-spacing"><div class="row col-sm-12"><span class="btn btn-default" title="' + $translate.instant('download_visualization') + '" dashboard-item-id="' + item.id + '" dashboard-item-name="' + item.visualization.displayName + '" dashboard-item-type="' + item.type + '" dhis2-dashboard-download><i class="fa fa-download"></i></span></div><div class="col-sm-12" id=' + item.id + ' "></div></div>');
                $div.append('<div class="dashboard-item-container vertical-spacing"><div class="row col-sm-12"><span class="btn btn-default" title="{{\'download_visualization\' | translate}}" dashboard-item-id="' + item.id + '" dashboard-item-name="item.visualization.displayName" dashboard-item-type="' + item.type + '" dhis2-dashboard-download><i class="fa fa-download"></i></span></div><div class="col-sm-12" id=' + item.id + ' "></div></div>');

                switch( item.type ){
                    case 'CHART':
                            chartItems.push( {
                                url: base,
                                el: item.id,
                                id: item.visualization.id} );
                            break;
                    case 'REPORT_TABLE':
                            tableItems.push( {url: base, el: item.id, id: item.visualization.id} );
                            break;
                    case 'MAP':
                            mapItems.push( {url: base, el: item.id, id: item.visualization.id} );
                            break;
                            default:
                            break;
                }

            });

            if( chartItems.length > 0 ){
                chartPlugin.url = base;
                chartPlugin.showTitles = true;
                chartPlugin.load( chartItems );
            }

            if( tableItems.length > 0 ){
                reportTablePlugin.url = base;
                reportTablePlugin.showTitles = true;
                reportTablePlugin.load( tableItems );
            }

            var com = $compile($div)(scope);
            element.append(com);
        }
    };
})*/

.directive('dhis2Dashboard', function ($translate, $timeout, $compile) {
    return {
        restrict: 'EA',
        scope: {
            dashboard: "=",
            downloadlabel: "=",
            charts: "=",
            tables: "=",
            maps: "="
        },
        template: '<div id="dashboardItemContainer"></div>',
        link: function (scope, element, attrs) {

            var base = "..";

            var $div = $("#dashboardItemContainer");

            $div.empty();

            var chartItems = [], tableItems = [], mapItems = [], _chartItems = [];

            $.each(scope.dashboard, function (i, item) {
                console.log('item:  ', item);
                $div.append('<div class="dashboard-item-container vertical-spacing"><div class="row col-sm-12"><span class="btn btn-default" title="{{\'download_visualization\' | translate}}" dashboard-item-id="' + item.id + '" dashboard-item-name="item.visualization.displayName" dashboard-item-type="' + item.type + '" dhis2-dashboard-download><i class="fa fa-download"></i></span></div><div class="col-sm-12" id=' + item.id + ' "></div></div>');
                switch( item.type ){
                    case 'CHART':
                        chartItems.push( {url: base, el: item.id, id: item.chart.id} );
                        break;
                    case 'EVENT_CHART':
                        _chartItems.push( {url: base, el: item.id, id: item.eventChart.id} );
                        break;
                    case 'REPORT_TABLE':
                        tableItems.push( {url: base, el: item.id, id: item.reportTable.id} );
                        break;
                    case 'MAP':
                        mapItems.push( {url: base, el: item.id, id: item.map.id} );
                        break;
                        default:
                        break;
                }
            });

            if( chartItems.length > 0 ){
                chartPlugin.url = base;
                chartPlugin.showTitles = true;
                chartPlugin.load( chartItems );
            }

            if( _chartItems.length > 0 ){
                console.log('eventChartItems:  ', _chartItems);
                eventChartPlugin.url = base;
                eventChartPlugin.showTitles = true;
                eventChartPlugin.load( _chartItems );
            }

            if( tableItems.length > 0 ){
                reportTablePlugin.url = base;
                reportTablePlugin.showTitles = true;
                reportTablePlugin.load( tableItems );
            }

            //var com = $compile($div)(scope);
            //element.append(com);
        }
    };
})

//dhis2-dashboard-download
.directive('dhis2DashboardDownload', function($window, DashboardService, DashboardItemService ){
    return {
        restrict: 'A',
        scope: {
            dashboardItemId: "=",
            dashboardItemName: "=",
            dashboardItemType: "="
        },
        link: function (scope, element, attrs) {
            element.click(function(){
                var items = DashboardItemService.getDashboardItems();
                if ( items && items[attrs.dashboardItemId] ){
                    var dashboardItem = items[attrs.dashboardItemId];
                    if ( dashboardItem.type === 'CHART' || dashboardItem.type === 'MAP' ){
                        var svg = $("#" + dashboardItem.id ).contents();
                        DashboardService.download({fileName: dashboardItem.name, svg: svg[0].innerHTML}).then(function( result ){
                            var blob = new Blob([result], {type: "image/png"});
                            saveAs(blob, dashboardItem.name + ".png");

                            //var url = $window.URL.createObjectURL( blob );
                            //$window.open(url, '_blank', scope.dashboardItemName + ".png");
                        });
                    }
                    else if( dashboardItem.type === 'REPORT_TABLE' ){
                        var blob = new Blob([$("#" + dashboardItem.id ).html()], {
                            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=utf-8"
                        });

                        var reportName = dashboardItem.name + ".xls";

                        saveAs(blob, reportName);
                    }
                }
            });
        }
    };
})

.directive('d2MultiSelect', function ($q) {
    return {
        restrict: 'E',
        require: 'ngModel',
        scope: {
            selectedLabel: "@",
            availableLabel: "@",
            displayAttr: "@",
            available: "=",
            model: "=ngModel"
        },
        template:   '<div class="row">'+
                        '<div class="col-sm-5">' +
                            '<div class="select-list-labels">{{ availableLabel }}</div>' +
                            '<div><select class="multiSelectAvailable" ng-dblclick="add()" ng-model="selected.available" multiple ng-options="e as e[displayAttr] for e in available | filter:filterText | orderBy: \'id\'"></select></div>' +
                        '</div>' +
                        '<div class="col-sm-2">' +
                            '<div class="select-list-buttons">' +
                                '<button title="{{\'select\' | translate}}" class="btn btn-primary btn-block" ng-click="add()" ng-disabled="selected.available.length == 0">' +
                                    '<i class="fa fa-angle-right"></i>' +
                                '</button>' +
                                '<div class="small-vertical-spacing">' +
                                    '<button title="{{\'select_all\' | translate}}" class="btn btn-success btn-block" ng-click="addAll()" ng-disabled="available.length == 0">' +
                                        '<i class="fa fa-angle-double-right"></i>' +
                                    '</button>' +
                                '</div>' +
                            '</div>' +
                            '<div class="small-vertical-spacing">' +
                                '<button title="{{\'remove\' | translate}}" class="btn btn-warning btn-block" ng-click="remove()" ng-disabled="selected.current.length == 0">' +
                                    '<i class="fa fa-angle-left"></i>' +
                                '</button>' +
                            '</div>' +
                            '<div class="small-vertical-spacing">' +
                                '<button title="{{\'remove_all\' | translate}}" class="btn btn-danger btn-block" ng-click="removeAll()" ng-disabled="model.length == 0">' +
                                    '<i class="fa fa-angle-double-left"></i>' +
                                '</button>' +
                            '</div>' +
                        '</div>' +
                        '<div class="col-sm-5">' +
                            '<div class="select-list-labels">{{ selectedLabel }}<span class="required">*</span></div>' +
                            '<div><select class="multiSelectSelected" ng-dblclick="remove()" name="multiSelectSelected" ng-model="selected.current" multiple ng-options="e as e[displayAttr] for e in model | orderBy: \'id\'"></select></div>' +
                        '</div>' +
                    '</div>',
        link: function (scope, elm, attrs) {
            scope.selected = {
                available: [],
                current: []
            };

            // Handles cases where scope data hasn't been initialized yet
            var dataLoading = function (scopeAttr) {
                var loading = $q.defer();
                if (scope[scopeAttr]) {
                    loading.resolve(scope[scopeAttr]);
                } else {
                    scope.$watch(scopeAttr, function (newValue, oldValue) {
                        if (newValue !== undefined)
                            loading.resolve(newValue);
                    });
                }
                return loading.promise;
            };

            // Filters out items in original that are also in toFilter. Compares by reference.
            var filterOut = function (original, toFilter) {
                var filtered = [];
                angular.forEach(original, function (entity) {
                    var match = false;
                    for (var i = 0; i < toFilter.length; i++) {
                        if (toFilter[i][attrs.displayAttr] === entity[attrs.displayAttr]) {
                            match = true;
                            break;
                        }
                    }
                    if (!match) {
                        filtered.push(entity);
                    }
                });
                return filtered;
            };

            scope.refreshAvailable = function () {
                scope.available = filterOut(scope.available, scope.model);
                scope.selected.available = [];
                scope.selected.current = [];
            };

            scope.add = function () {
                scope.model = scope.model.concat(scope.selected.available);
                scope.refreshAvailable();
            };

            scope.addAll = function() {
                scope.model = scope.model.concat( scope.available );
                scope.refreshAvailable();
            };

            scope.remove = function () {
                scope.available = scope.available.concat(scope.selected.current);
                scope.model = filterOut(scope.model, scope.selected.current);
                scope.refreshAvailable();
            };

            scope.removeAll = function() {
                scope.available = scope.available.concat(scope.model);
                scope.model = [];
                scope.refreshAvailable();
            };

            $q.all([dataLoading("model"), dataLoading("available")]).then(function (results) {
                scope.refreshAvailable();
            });
        }
    };
});
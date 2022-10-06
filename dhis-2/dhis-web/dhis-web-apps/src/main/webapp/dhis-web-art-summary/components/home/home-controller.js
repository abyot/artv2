/* global angular, dhis2, art */

'use strict';

//Controller for settings page
artSummary.controller('HomeController',
        function($scope,
                $translate,
                $modal,
                $filter,
                SessionStorageService,
                ArtService,
                DashboardService,
                PeriodService,
                ProgramFactory,
                MetaDataFactory) {

    $scope.model = {
        metaDataCached: false,
        menus: [],
        optionSets: null,
        trackedEntityAttributes: null,
        dataElementsById: null,
        selectedProgram: null,
        programs: [],
        arts: [],
        art: {},
        artHeaders: [],
        summaryHeaders: [],
        sortHeader: null,
        periods: [],
        periodType: 'FinancialJuly',
        periodOffset: 0,
        openFuturePeriods: 0,
        selectedPeriod: null,
        recommendationsFetched: false,
        recommendationDate: null,
        implementationDate: null,
        filterParam: '',
        selectedArt: null
    };

    var applyPeriodFitlerParam = function(){
        $scope.model.filterParam = '&filter=' + $scope.model.recommendationDate.id + ':ge:' + $scope.model.selectedPeriod.startDate;
        $scope.model.filterParam += ':le:' + $scope.model.selectedPeriod.endDate;
    };

    //watch for selection of org unit from tree
    $scope.$watch('selectedOrgUnit', function() {
        $scope.reset();
        if( angular.isObject($scope.selectedOrgUnit)){
            $scope.model.recommendationsFetched = false;
            SessionStorageService.set('SELECTED_OU', $scope.selectedOrgUnit);
            if ( !$scope.model.optionSets ){
                $scope.model.optionSets = [];
                $scope.model.trafficLight = [];
                MetaDataFactory.getAll('optionSets').then(function(optionSets){
                    angular.forEach(optionSets, function(optionSet){
                        $scope.model.optionSets[optionSet.id] = optionSet;
                        if ( optionSet.isTrafficLight ){
                            angular.forEach(optionSet.options, function(op){
                                $scope.model.trafficLight.push({code: op.code, id: op.code, displayName: op.displayName});
                            });
                        }
                    });

                    $scope.model.dataElementsById = [];
                    MetaDataFactory.getAll('dataElements').then(function(des){
                        angular.forEach(des, function(de){
                            $scope.model.dataElementsById[de.id] = de;
                        });

                        $scope.model.trackedEntityAttributes = [];
                        MetaDataFactory.getAll('trackedEntityAttributes').then(function(teas){
                            angular.forEach(teas, function(tea){
                                $scope.model.trackedEntityAttributes[tea.id] = tea;
                            });

                            ProgramFactory.getAll('programs').then(function(programs){
                                $scope.model.programs = programs;

                                $scope.model.selectedProgram = programs.length > 0 ? programs[0] : null;

                                $scope.model.metaDataCached = true;
                                $scope.model.menus.push({
                                    id: 'SRY',
                                    order: 1,
                                    header: $translate.instant('summary'),
                                    view: 'components/home/summary.html',
                                    active: true
                                }/*,{
                                    id: 'KPI',
                                    order: 2,
                                    header: $translate.instant('kpis'),
                                    view: 'components/home/kpis.html'
                                },{
                                    id: 'DBD',
                                    order: 3,
                                    header: $translate.instant('dashboard'),
                                    view: 'components/home/dashboard.html'
                                }*/);

                                $scope.model.selectedMenu = {
                                    id: 'SRY',
                                    header: $translate.instant('summary'),
                                    view: 'components/home/summary.html'
                                };

                                $scope.model.summaryHeaders = [{
                                    id: 'name',
                                    displayName: $translate.instant('budget_institution')
                                },{
                                    id: 'total',
                                    displayName: $translate.instant('recommendation_count')
                                }];

                                if ( $scope.model.trafficLight.length > 0 ){
                                    $scope.model.summaryHeaders = $scope.model.summaryHeaders.concat( $scope.model.trafficLight );
                                }
                                $scope.model.sortHeader = {
                                    id: 'total',
                                    reverse: true
                                };

                                var periods = PeriodService.getPeriods($scope.model.periodType, $scope.model.periodOffset, $scope.model.openFuturePeriods);
                                $scope.model.periods = periods;
                                if ( $scope.model.periods.length > 0 ){
                                    $scope.model.selectedPeriod = $scope.model.periods[0];
                                }
                            });
                        });
                    });
                });
            }
            else{
                $scope.loadProgramDetails();
            }
        }
    });

    //watch for selection of program
    $scope.$watch('model.selectedProgram', function() {
        if( angular.isObject($scope.model.selectedProgram) && $scope.model.selectedProgram.id){
            $scope.loadProgramDetails();
        }
        else{
            $scope.reset();
        }
    });

    //watch for selection of program
    $scope.$watch('model.selectedPeriod', function() {
        if( angular.isObject($scope.model.selectedPeriod) && $scope.model.selectedPeriod.id){
            applyPeriodFitlerParam();
            $scope.fetchRecommendations();
        }
    });

    //load details for selected program
    $scope.loadProgramDetails = function (){
        $scope.model.recommendationsFetched = false;
        if( $scope.model.selectedProgram && $scope.model.selectedProgram.id ){
            $scope.model.voteColumn = {id: $scope.selectedOrgUnit.id, displayName: $translate.instant('vote_number')};
            $scope.model.artHeaders = [];
            $scope.filterText = {};
            $scope.model.recommendationsFetched = false;
            $scope.model.programStageDataElements = null;

            angular.forEach($scope.model.selectedProgram.programTrackedEntityAttributes, function(pat){
                if( pat.trackedEntityAttribute && pat.trackedEntityAttribute.id ){
                    var tea = $scope.model.trackedEntityAttributes[pat.trackedEntityAttribute.id];
                    if( tea ){
                        tea.filterWithRange = false;
                        if ( tea.valueType === 'DATE' ||
                            tea.valueType === 'NUMBER' ||
                            tea.valueType === 'INTEGER' ||
                            tea.valueType === 'INTEGER_POSITIVE' ||
                            tea.valueType === 'INTEGER_NEGATIVE' ||
                            tea.valueType === 'INTEGER_ZERO_OR_POSITIVE' ){
                            tea.filterWithRange = true;
                            $scope.filterText[tea.id] = {};
                        }
                        tea.displayInList = pat.displayInList;
                        tea.mandatory = pat.mandatory;
                        tea.show = tea.displayInList;


                        $scope.model.artHeaders.push(tea);

                        if ( tea.recommendationDate ){
                            $scope.model.recommendationDate = tea;
                        }
                        else if( tea.implementationDate ){
                            $scope.model.implementationDate = tea;
                        }
                    }
                }
            });

            applyPeriodFitlerParam();
            $scope.model.allArtHeaders = angular.copy( $scope.model.artHeaders );
            $scope.model.artHeaders = ($filter('filter')($scope.model.artHeaders, {optionSetValue: true}));

            $scope.model.dashboardName = $scope.model.selectedProgram.displayName;
            DashboardService.getByName( $scope.model.dashboardName ).then(function( result ){
                $scope.model.dashboardItems = result.dashboardItems;
                $scope.model.charts = result.charts;
                $scope.model.tables = result.tables;
                $scope.model.maps = result.maps;
                $scope.model.dashboardFetched = true;
                $scope.fetchRecommendations();
            });
        }
    };

    //fetch recommendations for selected orgunit and program combination
    $scope.fetchRecommendations = function(){
        if( $scope.selectedOrgUnit && $scope.selectedOrgUnit.id && $scope.model.selectedProgram && $scope.model.selectedProgram.id ){
            ArtService.search($scope.model.selectedProgram, $scope.selectedOrgUnit, null, $scope.model.filterParam, $scope.model.trackedEntityAttributes, $scope.model.dataElementsById, $scope.model.optionSets).then(function(arts){
                $scope.model.recommendationsFetched = true;
                $scope.model.arts = arts;
            });
        }
    };

    $scope.search = function(){

        applyPeriodFitlerParam();
        var filterExists = false;
        angular.forEach($scope.model.artHeaders, function(header){
            if ( $scope.filterText[header.id] ){
                if ( header.optionSetValue ){
                    if( $scope.filterText[header.id].length > 0  ){
                        var filters = $scope.filterText[header.id].map(function(filt) {return filt.code;});
                        if( filters.length > 0 ){
                            $scope.model.filterParam += '&filter=' + header.id + ':IN:' + filters.join(';');
                            filterExists = true;
                        }
                    }
                }
                else if ( header.filterWithRange ){
                    if( $scope.filterText[header.id].start && $scope.filterText[header.id].start !== "" || $scope.filterText[header.id].end && $scope.filterText[header.id].end !== ""){
                        $scope.model.filterParam += '&filter=' + header.id;
                        if( $scope.filterText[header.id].start ){
                            $scope.model.filterParam += ':GT:' + $scope.filterText[header.id].start;
                            filterExists = true;
                        }
                        if( $scope.filterText[header.id].end ){
                            $scope.model.filterParam += ':LT:' + $scope.filterText[header.id].end;
                            filterExists = true;
                        }
                    }
                }
                else{
                    $scope.model.filterParam += '&filter=' + header.id + ':like:' + $scope.filterText[header.id];
                    filterExists = true;
                }
            }
        });

        $scope.fetchRecommendations();

        /*if ( filterExists ){
            $scope.fetchRecommendations();
            $scope.model.displaySearchArt = false;
        }
        else{
            NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("search_param_empty") );
            return false;
        }*/
    };

    $scope.setSortHeader = function( header ){
        if ( header.id === $scope.model.sortHeader.id ){
            $scope.model.sortHeader.reverse = !$scope.model.sortHeader.reverse;
        }
        else{
            $scope.model.sortHeader = {
                id: header.id,
                reverse: false
            };
        }
    };

    $scope.removeStartFilterText = function(gridColumnId){
        $scope.filterText[gridColumnId].start = undefined;
    };

    $scope.removeEndFilterText = function(gridColumnId){
        $scope.filterText[gridColumnId].end = undefined;
    };

    $scope.resetFilter = function(){
        $scope.filterText = angular.copy($scope.emptyFilterText);
        $scope.filterArts(null, true);
    };


    $scope.interacted = function(field) {
        var status = false;
        if(field){
            status = $scope.outerForm.submitted || field.$dirty;
        }
        return status;
    };

    $scope.cancelSearch = function(){
        $scope.model.displaySearchArt = false;
        $scope.model.filterParam = '';
        $scope.fetchRecommendations();
    };

    $scope.reset= function(){
        $scope.model.artHeaders = [];
        $scope.model.arts = [];
        $scope.model.art = {};
    };

    $scope.showHideColumns = function(){
        var modalInstance = $modal.open({
            templateUrl: 'views/column-modal.html',
            controller: 'ColumnDisplayController',
            resolve: {
                gridColumns: function () {
                    return $scope.model.artHeaders;
                },
                hiddenGridColumns: function(){
                    return ($filter('filter')($scope.model.artHeaders, {show: false})).length;
                }
            }
        });

        modalInstance.result.then(function (gridColumns) {
            $scope.model.artHeaders = gridColumns;
        });
    };

    $scope.exportData = function ( name ) {
        var blob = new Blob([document.getElementById('exportTable').innerHTML], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=utf-8"
        });

        var reportName = "recommendation-summary-list.xls";
        if( name ){
            reportName = name + '.xls';
        }
        saveAs(blob, reportName);
    };

    $scope.getPeriods = function(mode){
        var periods = [];
        if( mode === 'NXT'){
            $scope.model.periodOffset = $scope.model.periodOffset + 1;
            periods = PeriodService.getPeriods($scope.model.periodType, $scope.model.periodOffset, $scope.model.openFuturePeriods);
        }
        else{
            $scope.model.periodOffset = $scope.model.periodOffset - 1;
            periods = PeriodService.getPeriods($scope.model.periodType, $scope.model.periodOffset, $scope.model.openFuturePeriods);
        }

        var periodsById = {};
        angular.forEach($scope.model.periods, function(p){
            periodsById[p.id] = p;
        });

        angular.forEach(periods, function(p){
            if( !periodsById[p.id] ){
                periodsById[p.id] = p;
            }
        });

        $scope.model.periods = Object.values( periodsById );

        $scope.model.allPeriods = angular.copy( $scope.model.periods );
    };

    $scope.showSummaryDetails = function( art ){
        if ( $scope.model.selectedArt && $scope.model.selectedArt.ou === art.ou ){
            $scope.model.selectedArt = null;
        }
        else{
            $scope.model.selectedArt = art;
        }
    };

    $scope.showArtDetails = function( art ){

        var modalInstance = $modal.open({
            templateUrl: 'components/detail/detail.html',
            controller: 'DetailController',
            windowClass: 'modal-window-detail',
            resolve: {
                selectedArt: function(){
                    return art;
                },
                selectedProgram: function(){
                    return $scope.model.selectedProgram;
                },
                trackedEntityAttributesById: function(){
                    return $scope.model.trackedEntityAttributes;
                },
                dataElementsById: function(){
                    return $scope.model.dataElementsById;
                },
                optionSetsById: function(){
                    return $scope.model.optionSets;
                },
                artHeaders: function(){
                    return $scope.model.allArtHeaders;
                }
            }
        });

        modalInstance.result.then(function(){
        });
    };
});

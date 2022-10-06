/* global angular, moment, dhis2, parseFloat */

'use strict';

/* Services */

var artSummaryServices = angular.module('artSummaryServices', ['ngResource'])

.factory('D2StorageService', function(){
    var store = new dhis2.storage.Store({
        name: "dhis2art",
        adapters: [dhis2.storage.IndexedDBAdapter, dhis2.storage.DomSessionStorageAdapter, dhis2.storage.InMemoryAdapter],
        objectStores: ['programs', 'optionSets', 'trackedEntityAttributes', 'attributes', 'dataElements', 'ouLevels']
    });
    return{
        currentStore: store
    };
})

.service('PeriodService', function(CalendarService, DateUtils){

    this.getPeriods = function(periodType, periodOffset, futurePeriods){
         if(!periodType){
            return [];
        }

        var extractDate = function( obj ){
            return obj._year + '-' + String("0" + obj._month).slice(-2) + '-' + String("0" + obj._day).slice(-2);
        };

        var formatName = function( obj ){

            if ( periodType === 'FinancialJuly' ){
                obj.name = 'FY ' + obj._startDate._year + '/' + String( obj._endDate._year ).slice(2,4);
            }
            return obj;
        };

        var calendarSetting = CalendarService.getSetting();

        dhis2.period.format = calendarSetting.keyDateFormat;

        dhis2.period.calendar = $.calendars.instance( calendarSetting.keyCalendar );

        dhis2.period.generator = new dhis2.period.PeriodGenerator( dhis2.period.calendar, dhis2.period.format );

        dhis2.period.picker = new dhis2.period.DatePicker( dhis2.period.calendar, dhis2.period.format );

        var d2Periods = dhis2.period.generator.generateReversedPeriods( periodType, periodOffset );

        d2Periods = dhis2.period.generator.filterOpenPeriods( periodType, d2Periods, futurePeriods, null, null );

        angular.forEach(d2Periods, function(p){
            p.endDate = extractDate(p._endDate);
            p.startDate = extractDate(p._startDate);
            p = formatName(p);
            p.displayName = p.name;
            p.id = p.iso;
        });

        return d2Periods;
    };
})

/* Context menu for grid*/
.service('SelectedMenuService', function () {
    this.selectedMenu = null;

    this.setSelectedMenu = function (selectedMenu) {
        this.selectedMenu = selectedMenu;
    };

    this.getSelectedMenu= function () {
        return this.selectedMenu;
    };
})

/* Factory to fetch optionSets */
.factory('OptionSetService', function($q, $rootScope, D2StorageService) {
    return {
        getAll: function(){

            var def = $q.defer();

            D2StorageService.currentStore.open().done(function(){
                D2StorageService.currentStore.getAll('optionSets').done(function(optionSets){
                    $rootScope.$apply(function(){
                        def.resolve(optionSets);
                    });
                });
            });

            return def.promise;
        },
        get: function(uid){
            var def = $q.defer();

            D2StorageService.currentStore.open().done(function(){
                D2StorageService.currentStore.get('optionSets', uid).done(function(optionSet){
                    $rootScope.$apply(function(){
                        def.resolve(optionSet);
                    });
                });
            });
            return def.promise;
        },
        getCode: function(options, key){
            if(options){
                for(var i=0; i<options.length; i++){
                    if( key === options[i].displayName){
                        return options[i].code;
                    }
                }
            }
            return key;
        },
        getName: function(options, key){
            if(options){
                for(var i=0; i<options.length; i++){
                    if( key === options[i].code){
                        return options[i].displayName;
                    }
                }
            }
            return key;
        }
    };
})

/* Factory to fetch programs */
.factory('ProgramFactory', function($q, $rootScope, D2StorageService, CommonUtils, orderByFilter) {

    return {
        get: function(uid){

            var def = $q.defer();

            D2StorageService.currentStore.open().done(function(){
                D2StorageService.currentStore.get('programs', uid).done(function(ds){
                    $rootScope.$apply(function(){
                        def.resolve(ds);
                    });
                });
            });
            return def.promise;
        },
        getByOu: function(ou, selectedProgram){
            var def = $q.defer();

            D2StorageService.currentStore.open().done(function(){
                D2StorageService.currentStore.getAll('programs').done(function(prs){
                    var programs = [];
                    angular.forEach(prs, function(pr){
                        if(pr.organisationUnits.hasOwnProperty( ou.id ) && pr.id && CommonUtils.userHasWriteAccess( 'ACCESSIBLE_PROGRAMS', pr.id)){
                            programs.push(pr);
                        }
                    });

                    programs = orderByFilter(programs, '-displayName').reverse();

                    if(programs.length === 0){
                        selectedProgram = null;
                    }
                    else if(programs.length === 1){
                        selectedProgram = programs[0];
                    }
                    else{
                        if(selectedProgram){
                            var continueLoop = true;
                            for(var i=0; i<programs.length && continueLoop; i++){
                                if(programs[i].id === selectedProgram.id){
                                    selectedProgram = programs[i];
                                    continueLoop = false;
                                }
                            }
                            if(continueLoop){
                                selectedProgram = null;
                            }
                        }
                    }

                    if(!selectedProgram || angular.isUndefined(selectedProgram) && programs.legth > 0){
                        selectedProgram = programs[0];
                    }

                    $rootScope.$apply(function(){
                        def.resolve({programs: programs, selectedProgram: selectedProgram});
                    });
                });
            });
            return def.promise;
        },
        getAll: function(){
            var def = $q.defer();

            D2StorageService.currentStore.open().done(function(){
                D2StorageService.currentStore.getAll('programs').done(function(prs){
                    var programs = [];
                    angular.forEach(prs, function(pr){
                        if(CommonUtils.userHasReadAccess( 'ACCESSIBLE_PROGRAMS', pr.id)){
                            programs.push(pr);
                        }
                    });

                    programs = orderByFilter(programs, '-displayName').reverse();

                    $rootScope.$apply(function(){
                        def.resolve( programs );
                    });
                });
            });
            return def.promise;
        }
    };
})

/* factory to fetch and process programValidations */
.factory('MetaDataFactory', function($q, $rootScope, D2StorageService, orderByFilter) {

    return {
        get: function(store, uid){
            var def = $q.defer();
            D2StorageService.currentStore.open().done(function(){
                D2StorageService.currentStore.get(store, uid).done(function(obj){
                    $rootScope.$apply(function(){
                        def.resolve(obj);
                    });
                });
            });
            return def.promise;
        },
        set: function(store, obj){
            var def = $q.defer();
            D2StorageService.currentStore.open().done(function(){
                D2StorageService.currentStore.set(store, obj).done(function(obj){
                    $rootScope.$apply(function(){
                        def.resolve(obj);
                    });
                });
            });
            return def.promise;
        },
        getAll: function(store){
            var def = $q.defer();
            D2StorageService.currentStore.open().done(function(){
                D2StorageService.currentStore.getAll(store).done(function(objs){
                    objs = orderByFilter(objs, '-displayName').reverse();
                    $rootScope.$apply(function(){
                        def.resolve(objs);
                    });
                });
            });
            return def.promise;
        },
        getByProperty: function(store, prop, val){
            var def = $q.defer();
            D2StorageService.currentStore.open().done(function(){
                D2StorageService.currentStore.getAll(store).done(function(objs){
                    var selectedObject = null;
                    for(var i=0; i<objs.length; i++){
                        if(objs[i][prop] ){
                            objs[i][prop] = objs[i][prop].toLocaleLowerCase();
                            if( objs[i][prop] === val )
                            {
                                selectedObject = objs[i];
                                break;
                            }
                        }
                    }

                    $rootScope.$apply(function(){
                        def.resolve(selectedObject);
                    });
                });
            });
            return def.promise;
        }
    };
})

/* service for handling events */
.service('ArtService', function($http, $filter, DHIS2URL, CommonUtils, DateUtils) {

    var ArtFunctions = {
        getAge: function(art, recommendationAtt, implementationAtt){
            if ( !art || !recommendationAtt || !recommendationAtt.id || !art[recommendationAtt.id]){
                return;
            }

            if ( !implementationAtt.id || !art[implementationAtt] ){
                return DateUtils.getDifference( art[recommendationAtt.id], DateUtils.getToday());
            }

            return DateUtils.getDifference( art[recommendationAtt.id], art[implementationAtt.id]);
        },
        get: function(selectedArt, programs, selectedProgram, dataElementsById, optionSetsById){
            var promise = $http.get(DHIS2URL + '/trackedEntityInstances/' + selectedArt.instance + '.json?fields=*').then(function (response) {
                var tei = response.data;
                var enrollablePrograms = [], selectedEnrollment = null;
                if ( tei && tei.enrollments && tei.enrollments.length > 0 ){
                    angular.forEach(tei.enrollments, function(en){
                        enrollablePrograms = $filter('filter')(programs, function(pr) {
                            return (pr.id !== en.program );
                        }, true);

                        if ( en.program === selectedProgram.id ){
                            selectedEnrollment = en;
                            selectedEnrollment.enrollmentDate = DateUtils.formatFromApiToUser(selectedEnrollment.enrollmentDate);
                            selectedArt.enrollment = selectedEnrollment.enrollment;
                            selectedArt.enrollmentDate = angular.copy(selectedEnrollment.enrollmentDate);

                            selectedArt.status = [];
                            if ( en.events && en.events.length > 0 ){
                                angular.forEach(en.events, function(ev){
                                    ev.values = {};
                                    ev.eventDate = DateUtils.formatFromApiToUser(ev.eventDate);
                                    angular.forEach(ev.dataValues, function(dv){
                                        var val = dv.value;
                                        var de = dataElementsById[dv.dataElement];
                                        val = CommonUtils.formatDataValue(ev, val, de, optionSetsById, 'USER');
                                        ev.values[dv.dataElement] = val;
                                    });
                                    selectedArt.status.push( ev );
                                });
                            }
                        }
                    });
                }
                return {art: selectedArt, enrollment: selectedEnrollment, enrollablePrograms: enrollablePrograms};
            } ,function(error) {
                return null;
            });
            return promise;
        },
        getByProgramAndOu: function( program, orgUnit, sortHeader, filterText, attributesById, dataElementsById, optionSetsById, pageNumber ){
            var promise;
            if( program.id && orgUnit.id ){
                var order = 'order=created:desc';
                if ( sortHeader && sortHeader.id ){
                    order = 'order=' + sortHeader.id + ':' + sortHeader.direction;
                }
                if ( filterText ){
                    order += filterText;
                }

                var page = 1;
                if( pageNumber ){
                    page = pageNumber;
                }

                promise = $http.get(DHIS2URL + '/trackedEntityInstances/query.json?' + order + '&totalPages=false&pageSize=50&page='+ page + '&ouMode=SELECTED&ou=' + orgUnit.id + '&program=' + program.id).then(function (response) {
                    var arts = [];
                    var pager = {};
                    if ( response.data && response.data.headers && response.data.rows ){
                        var rows = response.data.rows, headers = response.data.headers,
                            recommendationAttribute = null, implementationAttribute = null;
                        pager = response.data.metadata.pager;
                        for (var i = 0; i<rows.length; i++) {
                            var art = {};
                            for( var j=0; j<rows[i].length; j++){
                                var val = rows[i][j];
                                var att = attributesById[headers[j].name];
                                if ( att ){
                                    val = CommonUtils.formatDataValue(null, val, att, optionSetsById, 'USER');
                                    if( att.optionSetValue ){
                                        var optionSet = optionSetsById[att.optionSet.id];
                                        if ( optionSet && optionSet.isTrafficLight ){
                                            art.trafficLight = rows[i][j];
                                        }
                                    }

                                    if( att.recommendationDate ){
                                        recommendationAttribute = att;
                                    }
                                    else if( att.implementationDate ){
                                        implementationAttribute = att;
                                    }
                                }
                                art[headers[j].name] = val;
                            }

                            art.age = ArtFunctions.getAge(art, recommendationAttribute, implementationAttribute);
                            art.trackedEntityInstance = art.instance;
                            art.trackedEntityType = art.te;
                            art.orgUnit = art.ou;
                            arts.push( art );
                        }
                    }
                    return {arts: arts, pager: pager};
                } ,function(error) {
                    return null;
                });
            }
            return promise;
        },
        search: function( program, orgUnit, sortHeader, filterText, attributesById, dataElementsById, optionSetsById ){
            var promise;
            if( program.id && orgUnit.id ){
                var order = 'order=created:desc';
                if ( sortHeader && sortHeader.id ){
                    order = 'order=' + sortHeader.id + ':' + sortHeader.direction;
                }
                if ( filterText ){
                    order += filterText;
                }

                promise = $http.get(DHIS2URL + '/trackedEntityInstances/query.json?' + order + '&totalPages=true&paging=false&pageSize=10000&ouMode=DESCENDANTS&ou=' + orgUnit.id + '&program=' + program.id).then(function (response) {
                    var arts = {};
                    if ( response.data && response.data.headers && response.data.rows ){
                        var rows = response.data.rows, headers = response.data.headers,
                        recommendationAttribute = null, implementationAttribute = null;
                        for (var i = 0; i<rows.length; i++) {
                            var cols = rows[i];
                            var ou = '', ouName = '', trafficLight = 'red';
                            var art = {};
                            for( var j=0; j<cols.length; j++){
                                var val = cols[j];
                                var att = attributesById[headers[j].name];
                                if ( val && att && att.isTrafficLight ){
                                    trafficLight = val;
                                }
                                if ( headers[j].name === 'ou' ){
                                    ou = cols[j];
                                }
                                else if ( headers[j].name === 'ouname' ){
                                    ouName = cols[j];
                                }

                                if ( att ){
                                    val = CommonUtils.formatDataValue(null, val, att, optionSetsById, 'USER');
                                    if( att.optionSetValue ){
                                        var optionSet = optionSetsById[att.optionSet.id];
                                        if ( optionSet && optionSet.isTrafficLight ){
                                            art.trafficLight = rows[i][j];
                                        }
                                    }

                                    if( att.recommendationDate ){
                                        recommendationAttribute = att;
                                    }
                                    else if( att.implementationDate ){
                                        implementationAttribute = att;
                                    }
                                }
                                art[headers[j].name] = val;
                            }
                            art.age = ArtFunctions.getAge(art, recommendationAttribute, implementationAttribute);
                            if ( ou ){
                                if ( arts[ou] ){
                                    arts[ou].total += 1;
                                    arts[ou].arts.push(art);
                                }
                                else{
                                    arts[ou] = {
                                        ou: ou,
                                        total: 1,
                                        name: ouName,
                                        red: 0,
                                        yellow: 0,
                                        green: 0,
                                        arts: [art]
                                    };
                                }
                                ++arts[ou][trafficLight];
                            }
                        }
                    }

                    if ( Object.keys( arts ).length > 0 ){
                        return Object.keys( arts ).map(function(key) { return arts[key]; });
                    }
                    return [];
                } ,function(error) {
                    return null;
                });
            }
            return promise;
        },
        add: function( art ){
            var promise = $http.post(DHIS2URL + '/trackedEntityInstances.json?strategy=SYNC', art).then(function (response) {
                return response.data;
            } ,function(error) {
                return error.data;
            });
            return promise;
        },
        update: function( art, programId ){
            var programFilter = programId ? "?program=" + programId : "";
            var promise = $http.put(DHIS2URL + '/trackedEntityInstances/' + art.trackedEntityInstance + programFilter, art).then(function (response) {
                return response.data;
            } ,function(error) {
                return error.data;
            });
            return promise;
        },
        updateEnrollment: function( enrollment ){
            var promise = $http.put(DHIS2URL + '/enrollments/' + enrollment.enrollment , enrollment).then(function (response) {
                return response.data;
            } ,function(error) {
                return error.data;
            });
            return promise;
        },
        updateStatus: function( event ){
            var promise = $http.put(DHIS2URL + '/events/' + event.event , event).then(function (response) {
                return response.data;
            } ,function(error) {
                return error.data;
            });
            return promise;
        },
        addStatus: function( event ){
            var promise = $http.post(DHIS2URL + '/events.json', event).then(function (response) {
                return response.data;
            } ,function(error) {
                return error.data;
            });
            return promise;
        },
        deleteStatus: function( event ){
            var promise = $http.delete(DHIS2URL + '/events/' + event.event).then(function(response){
                return response.data;
            });
            return promise;
        }
    };

    return ArtFunctions;
})


.service('DashboardItemService', function () {
    this.dashboardItems = null;

    this.setDashboardItems = function (dashboardItems) {
        this.dashboardItems = dashboardItems;
    };

    this.getDashboardItems= function () {
        return this.dashboardItems;
    };
})

.service('DashboardService', function($http, CommonUtils, DashboardItemService) {

    return {
        getByName: function( dashboardName ){
            var promise = $http.get('../api/dashboards.json?filter=name:eq:' + dashboardName + '&filter=publicAccess:eq:r-------&paging=false&fields=id,name,dashboardItems[id,type,reportTable[id,name,type],chart[id,name,type],eventChart[id,name,type]]' ).then(function(response){
                var result = {charts: [], tables: [], maps: [], dashboardItems: []};
                var itemsById = [];
                if( response.data && response.data.dashboards[0]){
                    angular.forEach(response.data.dashboards[0].dashboardItems, function(item){
                        var _item = {url: '..', el: item.id};
                        if ( item.type === 'CHART' ){
                            _item.id = item.chart.id;
                            _item.name = item.chart.name;
                            result.charts.push( _item );
                        }
                        else if ( item.type === 'REPORT_TABLE' ){
                            _item.id = item.reportTable.id;
                            _item.name = item.reportTable.name;
                            result.tables.push( _item );
                        }
                        else if ( item.type === 'MAP' ){
                            _item.id = item.map.id;
                            _item.name = item.map.name;
                            result.maps.push( _item );
                        }
                        else if ( item.type === 'EVENT_CHART' ){
                            _item.id = item.eventChart.id;
                            _item.name = item.eventChart.name;
                            result.tables.push( _item );
                        }

                        result.dashboardItems.push( item );
                        itemsById[item.id] = item;
                    });

                    DashboardItemService.setDashboardItems( itemsById );

                }
                return result;
            }, function( response ){
                CommonUtils.errorNotifier(response);
                return response.data;
            });
            return promise;
        },
        /*getByName: function( dashboardName ){
            var promise = $http.get('../api/dashboards.json?filter=name:like:' + dashboardName + '&filter=publicAccess:eq:r-------&paging=false&fields=id,name,dashboardItems[id,type,visualization[id,displayName]]' ).then(function(response){
                var result = {charts: [], tables: [], maps: [], dashboardItems: []};
                var itemsById = [];
                if( response.data && response.data.dashboards[0]){
                    angular.forEach(response.data.dashboards[0].dashboardItems, function(item){
                        result.dashboardItems.push( item );
                        itemsById[item.id] = {id: item.id, name: item.visualization.displayName, type: item.type};
                        var _item = {url: '..', el: item.id, id: item.visualization.id};
                        if ( item.type === 'CHART' ){
                            result.charts.push( _item );
                        }
                        else if ( item.type === 'REPORT_TABLE' ){
                            result.tables.push( _item );
                        }
                        else if ( item.type === 'MAP' ){
                            result.maps.push( _item );
                        }
                    });

                    DashboardItemService.setDashboardItems( itemsById );

                }
                return result;
            }, function( response ){
                CommonUtils.errorNotifier(response);
                return response.data;
            });
            return promise;
        },*/
        download: function( metadata ){
            var url = dhis2.ndp.apiUrl + '/svg.png';
            var serializedData = $.param({filename: metadata.fileName, svg: metadata.svg});
            var promise = $http({
                method: 'POST',
                url: url,
                data: serializedData,
                responseType: 'arraybuffer',
                headers: {'Content-Type': 'application/x-www-form-urlencoded'}
            }).then(function( response ){
                return response.data;
            });
            return promise;
        }
    };
})

/* Service for uploading/downloading file */
.service('FileService', function ($http, DHIS2URL) {

    return {
        get: function (uid) {
            var promise = $http.get(DHIS2URL + '/fileResources/' + uid).then(function (response) {
                return response.data;
            } ,function(error) {
                return null;
            });
            return promise;
        },
        download: function (fileName) {
            var promise = $http.get(fileName).then(function (response) {
                return response.data;
            }, function(error) {
                return null;
            });
            return promise;
        },
        upload: function(file){
            var formData = new FormData();
            formData.append('file', file);
            var headers = {transformRequest: angular.identity, headers: {'Content-Type': undefined}};
            var promise = $http.post(DHIS2URL + '/fileResources', formData, headers).then(function(response){
                return response.data;
            },function(error) {
               return null;
            });
            return promise;
        }
    };
})

.service('OrgUnitService', function($http){
    var orgUnit, orgUnitPromise;
    return {
        get: function( uid, level ){
            if( orgUnit !== uid ){
                orgUnitPromise = $http.get( '../api/organisationUnits.json?filter=path:like:/' + uid + '&filter=level:le:' + level + '&fields=id,displayName,path,level,parent[id]&paging=false' ).then(function(response){
                    orgUnit = response.data.id;
                    return response.data;
                });
            }
            return orgUnitPromise;
        }
    };
})

/*Orgunit service for local db */
.service('IndexDBService', function($window, $q){

    var indexedDB = $window.indexedDB;
    var db = null;

    var open = function( dbName ){
        var deferred = $q.defer();

        var request = indexedDB.open( dbName );

        request.onsuccess = function(e) {
          db = e.target.result;
          deferred.resolve();
        };

        request.onerror = function(){
          deferred.reject();
        };

        return deferred.promise;
    };

    var get = function(storeName, uid){

        var deferred = $q.defer();

        if( db === null){
            deferred.reject("DB not opened");
        }
        else{
            var tx = db.transaction([storeName]);
            var store = tx.objectStore(storeName);
            var query = store.get(uid);

            query.onsuccess = function(e){
                deferred.resolve(e.target.result);
            };
        }
        return deferred.promise;
    };

    return {
        open: open,
        get: get
    };
});
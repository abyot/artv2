/* global angular, dhis2, art */

'use strict';

//Controller for settings page
art.controller('HomeController',
        function($scope,
                $timeout,
                $translate,
                $modal,
                $filter,
                Paginator,
                ModalService,
                NotificationService,
                SessionStorageService,
                ArtService,
                ProgramFactory,
                MetaDataFactory,
                OrgUnitService,
                DateUtils,
                ExcelService,
                CalendarService,
                CommonUtils) {

    $scope.model = {
        optionSets: null,
        trackedEntityAttributes: null,
        dataElementsById: null,
        selectedProgram: null,
        trackedEntityAccess: false,
        selectedStage: null,
        selectedEvent: null,
        events: [],
        programs: [],
        arts: [],
        art: {},
        artHeaders: [],
        showEditArt: false,
        showAddArt: false,
        showImportArt: false,
        editProfile: false,
        inputFile: null,
        excelData: null,
        excelRows: [],
        excelColumns: [],
        selectedSheet: null,
        parsingStarted: false,
        parsingFinished: true,
        columnObjectMap: {},
        cellValidity: [],
        sortHeader: null,
        recommendationDate: null,
        implementationDate: null,
        orgUnitsByCode: {}
    };

    //Paging
    $scope.pager = {pageSize: 50, page: 1, toolBarDisplay: 5};

    //watch for selection of org unit from tree
    $scope.$watch('selectedOrgUnit', function() {
        if( angular.isObject($scope.selectedOrgUnit)){
            $scope.cancelEdit();
            $scope.model.cellValidity = [];
            SessionStorageService.set('SELECTED_OU', $scope.selectedOrgUnit);

            if ( !$scope.model.optionSets ){
                $scope.model.optionSets = [];
                OrgUnitService.getLocalOrgUnitsByCode().then(function( ous ){
                    $scope.model.orgUnitsByCode = ous;
                    MetaDataFactory.getAll('optionSets').then(function(optionSets){
                        angular.forEach(optionSets, function(optionSet){
                            $scope.model.optionSets[optionSet.id] = optionSet;
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

                                $scope.loadPrograms($scope.selectedOrgUnit);
                            });
                        });
                    });
                });
            }
            else{
                $scope.loadPrograms($scope.selectedOrgUnit);
            }
        }
        else{
            $scope.reset();
        }
    });

    //watch for selection of program
    $scope.$watch('model.selectedProgram', function() {
        $scope.model.arts = [];
        $scope.model.artHeaders = [];
        $scope.model.cellValidity = [];
        $scope.filterText = {};
        if( angular.isObject($scope.model.selectedProgram) && $scope.model.selectedProgram.id){
            $scope.loadProgramDetails();
        }
        else{
            $scope.reset();
        }
    });

    $scope.$watch('model.inputFile', function(){
        $scope.model.excelData = null;
        $scope.model.excelRows = [];
        $scope.model.excelColumns = [];
        $scope.model.cellValidity = [];
        if( angular.isObject($scope.model.inputFile) && $scope.model.inputFile[0]){
            ExcelService.load($scope.model.inputFile[0]).then(function(result) {
                $scope.model.excelData = result;
                $scope.$apply(function(){});
            });
        }
    });

    $scope.$watch('model.selectedSheet', function() {
        if( $scope.model.selectedSheet ){
            $scope.model.parsingStarted = true;
            $scope.model.parsingFinished = false;
            $scope.model.excelRows = [];
            $scope.model.excelColumns = [];
            $scope.model.cellValidity = [];

            $timeout(function() {
                var result = ExcelService.parse( $scope.model.excelData, $scope.model.selectedSheet);
                $scope.model.excelRows = result;
                $scope.model.parsingStarted = false;
                $scope.model.parsingFinished = true;

                if ( $scope.model.excelRows[0] ) {
                    Object.keys( $scope.model.excelRows[0] ).forEach( k => {
                        if( k !== '__EMPTY'){
                            $scope.model.excelColumns.push({
                                displayName: k
                            });
                        }
                    });
                }

            }, 10);
        }
    });

    //load programs associated with the selected org unit.
    $scope.loadPrograms = function() {
        $scope.model.programs = [];
        $scope.model.trackedEntityAccess = false;
        $scope.model.selectedOptionSet = null;
        $scope.model.cellValidity = [];
        $scope.model.arts = [];
        if (angular.isObject($scope.selectedOrgUnit)) {
            ProgramFactory.getByOu( $scope.selectedOrgUnit ).then(function(res){
                $scope.model.programs = res.programs || [];
                $scope.model.selectedProgram = res.selectedProgram || null;
            });
        }
    };

    //load details for selected program
    $scope.loadProgramDetails = function (){
        $scope.model.cellValidity = [];
        if( $scope.model.selectedProgram && $scope.model.selectedProgram.id &&  $scope.model.selectedProgram.programStages && $scope.model.selectedProgram.programStages.length > 0){
            $scope.model.voteColumn = {id: 'org_unit_id', displayName: $translate.instant('vote_number')};
            $scope.model.artHeaders = [];
            $scope.filterText = {};
            $scope.model.programStageDataElements = null;
            $scope.model.trackedEntityAccess =  CommonUtils.userHasWriteAccess( 'ACCESSIBLE_TRACKEDENTITYTYPE', $scope.model.selectedProgram.trackedEntityType.id);

            var programDetails = ArtService.getProgramDetails( $scope.model.selectedProgram, $scope.model.trackedEntityAttributes);

            $scope.model.artHeaders = programDetails.artHeaders;
            $scope.model.sortHeader = programDetails.sortHeader;
            $scope.filterText = programDetails.filterText;
            $scope.model.recommendationDate = programDetails.recommendationDate;
            $scope.model.implementationDate = programDetails.implementationDate;

            if ( !$scope.model.recommendationDate || !$scope.model.implementationDate ){
                NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("invalid_metadata_config") );
                return;
            }
            $scope.fetchRecommendations();
        }
        else if (!$scope.model.selectedProgram.programStages || $scope.model.selectedProgram.programStages.length < 1) {
            NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("invalid_metadata_config_stage") );
            return;
        }
    };

    //fetch recommendations for selected orgunit and program combination
    $scope.fetchRecommendations = function(){
        if( $scope.selectedOrgUnit && $scope.selectedOrgUnit.id && $scope.model.selectedProgram && $scope.model.selectedProgram.id ){
            //DESCENDANTS
            ArtService.getByProgramAndOu($scope.model.selectedProgram, $scope.selectedOrgUnit, $scope.model.sortHeader, $scope.filterParam, $scope.model.trackedEntityAttributes, $scope.model.dataElementsById, $scope.model.optionSets, $scope.pager).then(function(response){
                $scope.model.arts = response.arts;
                if( response.pager ){
                    response.pager.pageSize = response.pager.pageSize ? response.pager.pageSize : $scope.pager.pageSize;
                    $scope.pager = response.pager;
                    $scope.pager.toolBarDisplay = 5;

                    Paginator.setPage($scope.pager.page);
                    Paginator.setPageCount($scope.pager.pageCount);
                    Paginator.setPageSize($scope.pager.pageSize);
                    Paginator.setItemCount($scope.pager.total);
                }
            });
        }
    };

    $scope.jumpToPage = function(){
        if($scope.pager && $scope.pager.page && $scope.pager.pageCount && $scope.pager.page > $scope.pager.pageCount){
            $scope.pager.page = $scope.pager.pageCount;
        }
        $scope.fetchRecommendations();
    };

    $scope.resetPageSize = function(){
        $scope.pager.page = 1;
        $scope.fetchRecommendations();
    };

    $scope.getPage = function(page){
        $scope.pager.page = page;
        $scope.fetchRecommendations();
    };

    $scope.showAddArt = function(){
        $scope.model.displayAddArt = true;
        $scope.model.art = {};
    };

    $scope.showSearchArt = function(){
        $scope.model.displaySearchArt = true;
    };

    $scope.addArt = function(){
        //check for form validity
        $scope.outerForm.submitted = true;
        if( $scope.outerForm.$invalid ){
            NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("form_is_not_valid") );
            return false;
        }

        var rDate = DateUtils.getToday();//DateUtils.formatFromUserToApi($scope.model.art[$scope.model.recommendationDate.id]);
        var tei = {
            trackedEntityType: $scope.model.selectedProgram.trackedEntityType.id,
            orgUnit: $scope.selectedOrgUnit.id,
            enrollments: [
                {
                    program: $scope.model.selectedProgram.id,
                    enrollmentDate: rDate,
                    orgUnit: $scope.selectedOrgUnit.id,
                    trackedEntityType: $scope.model.selectedProgram.trackedEntityType.id,
                    events: [
                        {
                            program: $scope.model.selectedProgram.id,
                            programStage: $scope.model.selectedProgram.programStages[0].id,
                            orgUnit: $scope.selectedOrgUnit.id,
                            eventDate: rDate
                        }
                    ]
                }
            ],
            attributes: []
        };

        angular.forEach($scope.model.selectedProgram.programTrackedEntityAttributes, function(pat){
            var value = $scope.model.art[pat.trackedEntityAttribute.id];
            var tea = $scope.model.trackedEntityAttributes[pat.trackedEntityAttribute.id];
            value = CommonUtils.formatDataValue(null, value, tea, $scope.model.optionSets, 'API');

            if ( tea.optionSetValue ){
                var optionSet = $scope.model.optionSets[tea.optionSet.id];
                if ( optionSet && optionSet.isTrafficLight ){
                    $scope.model.art.trafficLight = value;
                }
            }

            if ( value ){
                tei.attributes.push({
                    attribute: tea.id,
                    value: value
                });
            }
        });

        /*ArtService.add(tei).then(function(data){
            if( data.response.importSummaries[0].status==='ERROR' ){
                NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("art_add_failed") + data.response.importSummaries[0].conflicts[0].value );
                return;
            }
            else{
                $scope.model.art.age = ArtService.getAge( $scope.model.art, $scope.model.recommendationDate, $scope.model.implementationDate);
                $scope.model.arts.splice(0,0,$scope.model.art);
            }
            $scope.cancelEdit();
        });*/
    };

    $scope.searchArt = function(){

        $scope.filterParam = '';
        $scope.model.filterExists = false;

        angular.forEach($scope.model.artHeaders, function(header){
            if ( $scope.filterText[header.id] ){
                if ( header.optionSetValue ){
                    if( $scope.filterText[header.id].length > 0  ){
                        var filters = $scope.filterText[header.id].map(function(filt) {return filt.code;});
                        if( filters.length > 0 ){
                            $scope.filterParam += '&filter=' + header.id + ':IN:' + filters.join(';');
                            $scope.model.filterExists = true;
                        }
                    }
                }
                else if ( header.filterWithRange ){
                    if( $scope.filterText[header.id].start && $scope.filterText[header.id].start !== "" || $scope.filterText[header.id].end && $scope.filterText[header.id].end !== ""){
                        $scope.filterParam += '&filter=' + header.id;
                        if( $scope.filterText[header.id].start ){
                            $scope.filterParam += ':GT:' + $scope.filterText[header.id].start;
                            $scope.model.filterExists = true;
                        }
                        if( $scope.filterText[header.id].end ){
                            $scope.filterParam += ':LT:' + $scope.filterText[header.id].end;
                            $scope.model.filterExists = true;
                        }
                    }
                }
                else{
                    $scope.filterParam += '&filter=' + header.id + ':like:' + $scope.filterText[header.id];
                    $scope.model.filterExists = true;
                }
            }
        });

        if ( $scope.model.filterExists ){
            $scope.fetchRecommendations('DESCENDANTS');
            $scope.model.displaySearchArt = false;
        }
        else{
            NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("search_param_empty") );
            return false;
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

    $scope.showEditArt = function(_selectedArt){
        var selectedArt = angular.copy( _selectedArt );
        $scope.model.displayEditArt = true;
        $scope.model.enrollablePrograms = $scope.model.programs;
        $scope.model.sourceArt = null;

        if ( selectedArt && selectedArt.instance && $scope.model.selectedProgram.programStages && $scope.model.selectedProgram.programStages.length > 0 ){
            $scope.model.selectedStage = $scope.model.selectedProgram.programStages[0];

             ArtService.get(selectedArt, $scope.model.enrollablePrograms, $scope.model.selectedProgram, $scope.model.dataElementsById, $scope.model.optionSets ).then(function( response ){
                if ( response.art && response.enrollment ){
                    $scope.model.sourceArt = response.art;
                    $scope.model.selectedEnrollment = response.enrollment;
                    selectedArt = response.art;
                    $scope.model.art = angular.copy(selectedArt);
                    $scope.model.originalArt = angular.copy(selectedArt);
                }
                else{
                    NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("invalid_tracking_information") );
                    return;
                }
            });
        }
    };

    $scope.updateArt = function(){
        //check for form validity
        $scope.outerForm.submitted = true;
        if( $scope.outerForm.$invalid ){
            NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("form_is_not_valid") );
            return false;
        }

        var tei = {
            trackedEntityType: $scope.model.art.trackedEntityType,
            trackedEntityInstance: $scope.model.art.trackedEntityInstance,
            orgUnit: $scope.model.art.orgUnit,
            attributes: []
        };

        angular.forEach($scope.model.selectedProgram.programTrackedEntityAttributes, function(pat){
            var value = $scope.model.art[pat.trackedEntityAttribute.id];
            var tea = $scope.model.trackedEntityAttributes[pat.trackedEntityAttribute.id];
            value = CommonUtils.formatDataValue(null, value, tea, $scope.model.optionSets, 'API');

            if ( tea.optionSetValue ){
                var optionSet = $scope.model.optionSets[tea.optionSet.id];
                if ( optionSet && optionSet.isTrafficLight ){
                    $scope.model.art.trafficLight = value;
                }
            }

            if ( value ){
                tei.attributes.push({
                    attribute: tea.id,
                    value: value
                });
            }
        });

        if ( $scope.model.selectedEnrollment.enrollmentDate !==  $scope.model.art[$scope.model.recommendationDate.id] ){
            var en = $scope.model.selectedEnrollment;
            en.enrollmentDate = DateUtils.formatFromUserToApi($scope.model.art[$scope.model.recommendationDate.id]);
            ArtService.updateEnrollment(en).then(function(){
            });
        }

        ArtService.update(tei, $scope.model.selectedProgram.id).then(function(data){
            if( data.response.status==='ERROR' ){
                NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("operation_failed") + data.response.description );
                return;
            }
            else{

                $scope.model.art.age = ArtService.getAge( $scope.model.art, $scope.model.recommendationDate, $scope.model.implementationDate);
                var index = -1;
                for( var i=0; i<$scope.model.arts.length; i++){
                    if( $scope.model.arts[i].trackedEntityInstance === $scope.model.art.trackedEntityInstance ){
                        index = i;
                        break;
                    }
                }
                if ( index !== -1 ){
                    $scope.model.arts.splice(index,1);
                    $scope.model.arts.splice(0,0,$scope.model.art);
                }
                else{
                    $scope.model.arts.splice(0,0,$scope.model.art);
                }
            }
            $scope.showEditProfile();
        });

    };

    $scope.showRecordAction = function( selectedEvent ){

        var modalInstance = $modal.open({
            templateUrl: 'components/status/art-status.html',
            controller: 'StatusController',
            resolve: {
                art: function(){
                    return angular.copy($scope.model.art);
                },
                selectedEvent: function(){
                    return angular.copy(selectedEvent);
                },
                stage: function(){
                    return $scope.model.selectedStage;
                },
                program: function(){
                    return $scope.model.selectedProgram;
                },
                enrollment: function(){
                    return $scope.model.selectedEnrollment;
                },
                dataElementsById: function(){
                    return $scope.model.dataElementsById;
                },
                optionSetsById: function(){
                    return $scope.model.optionSets;
                }
            }
        });

        modalInstance.result.then(function( art ) {
            $scope.model.art = angular.copy(art);
        });
    };

    $scope.showImportArt = function(){
        $scope.model.displaImportArt = true;
        $scope.model.cellValidity = [];
    };

    $scope.hideImportArt = function(){
        $scope.model.cellValidity = [];
        $scope.model.inputFile = null;
        $scope.model.excelData = null;
        $scope.model.excelRows = [];
        $scope.model.excelColumns = [];
        $scope.model.selectedSheet = null;
    };

    $scope.isOnAddEditMode = function(){
        return $scope.model.displayAddArt || $scope.model.displaImportArt || $scope.model.displayEditArt || $scope.model.displaySearchArt;
    };

    $scope.interacted = function(field) {
        var status = false;
        if(field){
            status = $scope.outerForm.submitted || field.$dirty;
        }
        return status;
    };

    $scope.cancelEdit = function(){
        $scope.model.art = angular.copy($scope.model.originalArt);
        $scope.model.displayAddArt = false;
        $scope.model.displaImportArt = false;
        $scope.model.displayEditArt = false;
        $scope.model.displaySearchArt = false;
        $scope.model.inputFile = null;
        $scope.model.excelData = null;
        $scope.model.excelRows = [];
        $scope.model.excelColumns = [];
        $scope.model.selectedSheet = null;
        $scope.model.parsingStarted = false;
        $scope.model.parsingFinished = true;
        $scope.resetForm();
    };

    $scope.cancelSearch = function(){
        $scope.model.displaySearchArt = false;
        $scope.filterParam = '';
        $scope.resetForm();
        $scope.fetchRecommendations();
    };

    $scope.showEditProfile = function(){
        $scope.model.editProfile = !$scope.model.editProfile;
    };

    $scope.cancelEditProfile = function(){
        $scope.model.art = $scope.model.originalArt;
        $scope.model.editProfile = false;
        $scope.resetForm();
    };

    $scope.cancelEditStatus = function(){
        $scope.model.selectedEvent = $scope.model.originalEvent;
        $scope.resetForm();
    };

    $scope.reset= function(){
        $scope.model.selectedProgram = null;
        $scope.model.artHeaders = [];
        $scope.model.arts = [];
        $scope.model.art = {};

        $scope.resetForm();
    };

    $scope.resetForm = function(){
        $scope.outerForm.submitted = false;
        $scope.outerForm.$setPristine();
    };

    $scope.addOrEditArtDenied = function(){
        return !$scope.model.trackedEntityAccess;
    };

    $scope.addOrEditStatusDenied = function(){
        return false;
    };

    $scope.sortItems = function( header ){
        $scope.reverse = ($scope.model.sortHeader && $scope.model.sortHeader.id === header.id) ? !$scope.reverse : false;
        var direction = 'asc';
        if ( $scope.model.sortHeader.id === header.id ){
            if ( $scope.model.sortHeader.direction === direction ){
                direction = 'desc';
            }
        }
        $scope.model.sortHeader = {id: header.id, direction: direction};
        $scope.fetchRecommendations();
    };

    $scope.deleteArt = function(){
        var modalOptions = {
            closeButtonText: 'no',
            actionButtonText: 'yes',
            headerText: 'warning',
            bodyText: 'are_you_sure_to_delete_art'
        };

        ModalService.showModal({}, modalOptions).then(function(){
            ArtService.delete($scope.model.art).then(function(result){
                var index = -1;
                for( var i=0; i<$scope.model.arts.length; i++){
                    if( $scope.model.arts[i].trackedEntityInstance === $scope.model.art.trackedEntityInstance  ){
                        index = i;
                        break;
                    }
                }
                if ( index !== -1 ){
                    $scope.model.arts.splice(index,1);
                }
                $scope.cancelEdit();
            }, function( result){
                CommonUtils.errorNotifier( result );
            });
        });
    };

    $scope.assignColumnToModel = function( column ){
        var isValidOption = function(optionSet, value){
            if (!value || value === ''){
                return true;
            }
            if ( optionSet && optionSet.options ){
               for(var i=0; i<optionSet.options.length; i++){
                    if( value === optionSet.options[i].displayName){
                        return true;
                    }
                }
            }
            return false;
        };

        delete $scope.model.cellValidity[column.displayName];

        if( column.mappedObject ){
            $scope.model.cellValidity[column.displayName] = {};
            if ( column.mappedObject === $scope.model.voteColumn.id ){
                var index = 0;
                angular.forEach($scope.model.excelRows, function(row){
                    $scope.model.cellValidity[column.displayName][index] = !CommonUtils.isBlank( $scope.model.orgUnitsByCode[row[column.displayName]] );
                    index++;
                });
            }
            else{
                var att = $scope.model.trackedEntityAttributes[column.mappedObject];
                if ( att ){
                    if ( att.unique ){
                        var index = 0;
                        angular.forEach($scope.model.excelRows, function(row){
                            var param = 'ouMode=ACCESSIBLE&program=' + $scope.model.selectedProgram.id + '&filter=' + att.id + ':eq:' + row[column.displayName];
                            ArtService.artExists( param ).then(function(response){
                                $scope.model.cellValidity[column.displayName][index] = !response;
                                index++;
                            });
                        });
                    }
                    else{
                        var index = 0;
                        angular.forEach($scope.model.excelRows, function(row){
                            var isValid = true, val = row[column.displayName];
                            if ( CommonUtils.isBlank( val ) )
                            {
                                if ( att.mandatory ){
                                    isValid = false;
                                }
                            }
                            else{
                                val = val.trim();
                                if ( att.optionSetValue ){
                                    isValid = isValidOption( $scope.model.optionSets[att.optionSet.id], val );
                                }
                                else if ( att.valueType === 'DATE' ){
                                    isValid = DateUtils.isValid( val );
                                }
                                else{
                                    isValid = dhis2.validation.isValidValueType( val, att.valueType );
                                }
                            }
                            $scope.model.cellValidity[column.displayName][index] = isValid;
                            index++;
                        });
                    }
                }
            }
        }
    };

    $scope.getUnAssignedHeaders = function( column ){
        var unAssignedHeaders = [];

        var isColumnAssigned = function( header ){
            var assigned = false;
            for( var i=0; i<$scope.model.excelColumns.length; i++){
                var col = $scope.model.excelColumns[i];
                if ( col.mappedObject === header.id && col.displayName !== column.displayName ){
                    assigned = true;
                    break;
                }
            }

            return assigned;
            if( !assigned ){
                unAssignedHeaders.push( header );
            }
        };

        var assigned = isColumnAssigned( $scope.model.voteColumn );
        if( !assigned ){
            unAssignedHeaders.push( $scope.model.voteColumn );
        }

        angular.forEach($scope.model.artHeaders, function(header){
            var assigned = isColumnAssigned( header );
            if( !assigned ){
                unAssignedHeaders.push( header );
            }
        });

        return unAssignedHeaders;
    };

    $scope.uploadExcel = function(){

        var attributesById = $scope.model.artHeaders.reduce(function(map, o){
            map[o.id] = o;
            return map;
        }, {});

        var columnsByAttribute = $scope.model.excelColumns.reduce(function(map, o){
            if ( o.displayName && o.mappedObject ){
                map[o.mappedObject] = o.displayName;
            }
            return map;
        }, {});

        var ouColumn = columnsByAttribute[$scope.model.voteColumn.id];
        if ( !ouColumn ){
            NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("vote_column_not_assigned") );
            return;
        }

        var artDateColumn = columnsByAttribute[$scope.model.recommendationDate.id];
        if ( !artDateColumn ){
            NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("recommendation_date_column_not_assigned") );
            return;
        }

        for( var i=0; i<$scope.model.artHeaders.length; i++ ){
            var att = $scope.model.artHeaders[i];
            if ( !columnsByAttribute[att.id] && ( att.unique || att.mandatory ) ){
                NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("required_column_not_assigned") + ':   ' + att.displayName );
                return;
            }
        }

        //Check for valid rows
        var index = 0;
        var arts = [];
        angular.forEach($scope.model.excelRows, function(row){
            var art = {attributes: [], trackedEntityType: $scope.model.selectedProgram.trackedEntityType.id};
            var validRow = true;
            for( var i=0; i<$scope.model.excelColumns.length && validRow; i++){
                var col = $scope.model.excelColumns[i];
                if ( col.mappedObject ){
                    validRow = $scope.model.cellValidity[col.displayName][index];
                    if ( !validRow ){
                        break;
                    }

                    if ( col.mappedObject === $scope.model.voteColumn.id ){
                        var ouValue = $scope.model.orgUnitsByCode[row[ouColumn]];
                        var rDate = row[artDateColumn];
                        var rDate = DateUtils.formatFromUserToApi(rDate);
                        art.orgUnit = ouValue;
                        art.enrollments = [
                            {
                                program: $scope.model.selectedProgram.id,
                                enrollmentDate: rDate,
                                orgUnit: ouValue,
                                trackedEntityType: $scope.model.selectedProgram.trackedEntityType.id,
                                events: [
                                    {
                                        program: $scope.model.selectedProgram.id,
                                        programStage: $scope.model.selectedProgram.programStages[0].id,
                                        orgUnit: ouValue,
                                        eventDate: rDate
                                    }
                                ]
                            }
                        ];
                    }
                    else{
                        var attribute = attributesById[col.mappedObject];
                        var columnId = columnsByAttribute[col.mappedObject];
                        var value = row[columnId];
                        if ( attribute && !CommonUtils.isBlank(value) && columnId ){
                            value = value.trim();
                            value = CommonUtils.formatDataValue(null, value, attribute, $scope.model.optionSets, 'API');
                            art.attributes.push({
                                attribute: attribute.id,
                                value: value
                            });
                        }
                    }
                }
            }

            if ( validRow && art.attributes.length > 0 ){
                arts.push( art );
            }
            index++;
        });

        if ( arts.length > 0 ){
            var diff = $scope.model.excelRows.length - arts.length;
            var modalOptions = {
                closeButtonText: 'no',
                actionButtonText: 'yes',
                headerText: 'warning',
                bodyText: 'are_you_sure_to_upload'
            };

            if ( diff > 0 ){
                modalOptions.bodyWarning = diff + ' - ' + $translate.instant('invalid_rows');
            }

            ModalService.showModal({}, modalOptions).then(function(){
                var teis = {
                    trackedEntityInstances: arts
                };
                $scope.model.excelUploadStarted = true;
                $scope.model.excelUploadFinished = false;
                ArtService.add(teis).then(function(response){
                    $scope.model.excelUploadStarted = false;
                    $scope.model.excelUploadFinished = true;
                    if(response.status === 'OK' ){
                        NotificationService.showNotifcationDialog($translate.instant("success"), response.message );
                    }
                    else{
                        NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("check_console") + '. Imported:  ' + response.response.imported + '. Ignored:  ' + response.response.ignored );
                    }
                    console.log('Import summary:  ', response);
                    $scope.hideImportArt();
                });
            });
        }
        else{
            NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant('no_valid_rows_to_import') );
            return;
        }
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

    $scope.additionalTracking = function(){
        var modalInstance = $modal.open({
            templateUrl: 'components/enrollment/art-enrollment.html',
            controller: 'EnrollmentController',
            resolve: {
                sourceArt: function(){
                    return angular.copy($scope.model.sourceArt);
                },
                art: function(){
                    return angular.copy($scope.model.art);
                },
                programs: function(){
                    return angular.copy($scope.model.enrollablePrograms);
                },
                trackedEntityAttributes: function(){
                    return $scope.model.trackedEntityAttributes;
                },
                dataElementsById: function(){
                    return $scope.model.dataElementsById;
                },
                optionSetsById: function(){
                    return $scope.model.optionSets;
                },
                selectedOrgUnit: function(){
                    return $scope.selectedOrgUnit;
                }
            }
        });

        modalInstance.result.then(function( art ) {
            $scope.model.art = angular.copy(art);
        });
    };

    $scope.exportData = function ( name ) {
        var blob = new Blob([document.getElementById('exportTable').innerHTML], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=utf-8"
        });

        var reportName = "recommendation-list.xls";
        if( name ){
            reportName = name + '.xls';
        }
        saveAs(blob, reportName);
    };
});

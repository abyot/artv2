/* global angular, dhis2, art */

'use strict';

//Controller for settings page
artSummary.controller('StatusController',
        function($scope,
                $modalInstance,
                $translate,
                NotificationService,
                ArtService,
                DateUtils,
                ModalService,
                CommonUtils,
                art,
                selectedEvent,
                stage,
                program,
                enrollment,
                dataElementsById,
                optionSetsById
                ) {

    $scope.art = art;
    $scope.stage = stage;
    $scope.program = program;
    $scope.enrollment = enrollment;
    $scope.dataElementsById = dataElementsById;
    $scope.optionSetsById = optionSetsById;

    if ( selectedEvent && selectedEvent.event ){
        $scope.selectedEvent = selectedEvent;
    }
    else{
        $scope.selectedEvent = {
            program: $scope.program.id,
            programStage: $scope.stage.id,
            orgUnit: $scope.art.orgUnit,
            enrollment: $scope.art.enrollment,
            trackedEntityInstance: $scope.art.trackedEntityInstance
        };
    }

    $scope.saveStatus = function(){
        //check for form validity
        $scope.outerForm.submitted = true;
        if( $scope.outerForm.$invalid ){
            NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("form_is_not_valid") );
            return false;
        }

        var ev = angular.copy( $scope.selectedEvent );
        ev.eventDate = DateUtils.formatFromUserToApi($scope.selectedEvent.eventDate);
        var dataValues = [];
        angular.forEach($scope.stage.programStageDataElements, function(psde){
            var value = $scope.selectedEvent.values[psde.dataElement.id];
            var de = $scope.dataElementsById[psde.dataElement.id];
            value = CommonUtils.formatDataValue(null, value, de, $scope.optionSetsById, 'API');

            if ( value ){
                dataValues.push({
                    dataElement: de.id,
                    value: value
                });
            }
        });

        ev.dataValues = dataValues;

        if ( ev.event ){
            ArtService.updateStatus( ev ).then(function(data){
                if( data.response.status==='ERROR' ){
                    NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("operation_failed") + data.response.description );
                    return;
                }

                var index = -1;
                for( var i=0; i<$scope.art.status.length; i++){
                    if( $scope.art.status[i].event === $scope.selectedEvent.event  ){
                        index = i;
                        break;
                    }
                }
                if ( index !== -1 ){
                    $scope.art.status.splice(index,1);
                    $scope.art.status.splice(0,0,$scope.selectedEvent);
                }
                else{
                    $scope.art.status.splice(0,0,$scope.selectedEvent);
                }
                $scope.close();
            });
        }
        else {
            ArtService.addStatus(ev).then(function(data){
                if( data.response.status==='ERROR' ){
                    NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("operation_failed") + data.response.description );
                    return;
                }
                $scope.art.status.splice(0,0,$scope.selectedEvent);
                $scope.close();
            });
        }
    };

    $scope.deleteStatus = function(){
        var modalOptions = {
            closeButtonText: 'no',
            actionButtonText: 'yes',
            headerText: 'warning',
            bodyText: 'are_you_sure_to_delete_status'
        };

        ModalService.showModal({}, modalOptions).then(function(response){

            ArtService.deleteStatus($scope.selectedEvent).then(function(result){
                var index = -1;
                for( var i=0; i<$scope.art.status.length; i++){
                    if( $scope.art.status[i].event === $scope.selectedEvent.event  ){
                        index = i;
                        break;
                    }
                }
                if ( index !== -1 ){
                    $scope.art.status.splice(index,1);
                }
                $scope.close();
            }, function( result){
                CommonUtils.errorNotifier( result );
            });
        });
    };

    $scope.interacted = function(field) {
        var status = false;
        if(field){
            status = $scope.outerForm.submitted || field.$dirty;
        }
        return status;
    };

    $scope.close = function () {
        $modalInstance.close( $scope.art );
    };
});

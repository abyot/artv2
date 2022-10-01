/* global angular, dhis2, art */

'use strict';

//Controller for settings page
art.controller('EnrollmentController',
        function($scope,
                $modalInstance,
                $translate,
                NotificationService,
                ArtService,
                DateUtils,
                CommonUtils,
                sourceArt,
                art,
                programs,
                trackedEntityAttributes,
                dataElementsById,
                optionSetsById,
                selectedOrgUnit
                ) {

    $scope.model = {
        sourceArt: sourceArt,
        art: art,
        selectedArt: angular.copy(art),
        programs: programs,
        trackedEntityAttributes: trackedEntityAttributes,
        dataElementsById: dataElementsById,
        optionSets: optionSetsById,
        selectedOrgUnit: selectedOrgUnit
    };

    //watch for selection of program
    $scope.$watch('model.selectedProgram', function() {
        $scope.model.artHeaders = [];
        $scope.model.sortHeader = {};
        $scope.filterText = {};
        $scope.model.recommendationDate = null;
        $scope.model.implementationDate = null;
        if( angular.isObject($scope.model.selectedProgram) && $scope.model.selectedProgram.id){
            var programDetails = ArtService.getProgramDetails( $scope.model.selectedProgram, $scope.model.trackedEntityAttributes);
            $scope.model.artHeaders = programDetails.artHeaders;
            $scope.model.sortHeader = programDetails.sortHeader;
            $scope.filterText = programDetails.filterText;
            $scope.model.recommendationDate = programDetails.recommendationDate;
            $scope.model.implementationDate = programDetails.implementationDate;
        }
    });

    $scope.saveEnrollment = function(){
        //check for form validity
        $scope.outerForm.submitted = true;
        if( $scope.outerForm.$invalid ){
            NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("form_is_not_valid") );
            return false;
        }

        var rDate = DateUtils.formatFromUserToApi($scope.model.art[$scope.model.recommendationDate.id]);
        var tei = {
            trackedEntityInstance: $scope.model.art.trackedEntityInstance,
            orgUnit: $scope.model.art.orgUnit,
            enrollments: [
                {
                    program: $scope.model.selectedProgram.id,
                    enrollmentDate: rDate,
                    orgUnit: $scope.model.selectedOrgUnit.id,
                    events: [
                        {
                            program: $scope.model.selectedProgram.id,
                            programStage: $scope.model.selectedProgram.programStages[0].id,
                            orgUnit: $scope.model.selectedOrgUnit.id,
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

        ArtService.add(tei).then(function(data){
            if( data.response.importSummaries[0].status==='ERROR' ){
                NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("art_add_failed") + data.response.importSummaries[0].conflicts[0].value );
                return;
            }
            NotificationService.showNotifcationDialog($translate.instant("success"), $translate.instant("art_additional_tracking") + ":  " + $scope.model.selectedProgram.displayName);
            $scope.close();
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
        $modalInstance.close( $scope.model.selectedArt );
    };
});

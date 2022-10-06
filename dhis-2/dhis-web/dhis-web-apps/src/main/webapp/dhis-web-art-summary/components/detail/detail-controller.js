/* global angular, dhis2, art */

'use strict';

//Controller for settings page
artSummary.controller('DetailController',
        function($scope,
                $modalInstance,
                ArtService,
                selectedArt,
                selectedProgram,
                trackedEntityAttributesById,
                dataElementsById,
                optionSetsById,
                artHeaders) {

    $scope.model = {
        selectedArt: selectedArt,
        selectedProgram: selectedProgram,
        trackedEntityAttributes: trackedEntityAttributesById,
        dataElementsById: dataElementsById,
        optionSets: optionSetsById,
        artHeaders: artHeaders
    };
    
    if ( selectedArt && selectedArt.instance ){
        $scope.model.selectedStage = $scope.model.selectedProgram.programStages[0];
        ArtService.get(selectedArt, [], $scope.model.selectedProgram, $scope.model.dataElementsById, $scope.model.optionSets ).then(function( response ){
            $scope.model.art = response.art;
            $scope.model.selectedEnrollment = response.enrollment;
            console.log('art:  ', $scope.model.art);
        });
    }

    $scope.cancel = function(){
        $modalInstance.close();
    };
});

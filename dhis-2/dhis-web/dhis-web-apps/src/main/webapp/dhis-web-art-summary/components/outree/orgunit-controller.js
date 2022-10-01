/* global angular */

'use strict';


artSummary.controller('OuTreeController',
        function($scope,
                $modalInstance,
                orgUnits,
                selectedOrgUnit,
                validOrgUnits,
                OrgUnitFactory){

    $scope.orgUnits = orgUnits;
    $scope.selectedOrgUnit = selectedOrgUnit;
    $scope.validOrgUnits = validOrgUnits;
    $scope.treeLoadingStarted = false;
    $scope.treeLoaded = true;
    //expand/collapse of search orgunit tree
    $scope.expandCollapse = function(orgUnit) {
        if( orgUnit.hasChildren ){
            //Get children for the selected orgUnit
            $scope.treeLoadingStarted = true;
            $scope.treeLoaded = false;
            OrgUnitFactory.getChildren(orgUnit.id).then(function(ou) {
                orgUnit.show = !orgUnit.show;
                orgUnit.hasChildren = false;
                orgUnit.children = ou.children;
                angular.forEach(orgUnit.children, function(ou){
                    ou.hasChildren = ou.children && ou.children.length > 0 ? true : false;
                });
                $scope.treeLoadingStarted = false;
                $scope.treeLoaded = true;
            });
        }
        else{
            orgUnit.show = !orgUnit.show;
        }
    };

    $scope.setSelectedOrgUnit = function( orgUnit ){
    	$scope.selectedOrgUnit = orgUnit;
    };

    $scope.select = function () {
        $modalInstance.close( $scope.selectedOrgUnit );
    };

    $scope.cancel = function(){
        $modalInstance.close();
    };
});

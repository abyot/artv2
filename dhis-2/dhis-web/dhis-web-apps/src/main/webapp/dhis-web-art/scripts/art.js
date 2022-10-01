
/* global dhis2, angular, selection, i18n_ajax_login_failed, _ */

dhis2.util.namespace('dhis2.art');
dhis2.util.namespace('dhis2.tc');

// whether current user has any organisation units
dhis2.art.emptyOrganisationUnits = false;

dhis2.art.apiUrl = '../api';

var i18n_no_orgunits = 'No organisation unit attached to current user, no data entry possible';
var i18n_offline_notification = 'You are offline';
var i18n_online_notification = 'You are online';
var i18n_ajax_login_failed = 'Login failed, check your username and password and try again';

var optionSetsInPromise = [];
var attributesInPromise = [];
var batchSize = 50;

dhis2.art.store = null;
dhis2.tc.metaDataCached = dhis2.tc.metaDataCached || false;
dhis2.art.metaDataCached = dhis2.art.metaDataCached || false;
dhis2.art.memoryOnly = $('html').hasClass('ie7') || $('html').hasClass('ie8');
var adapters = [];
if( dhis2.art.memoryOnly ) {
    adapters = [ dhis2.storage.InMemoryAdapter ];
} else {
    adapters = [ dhis2.storage.IndexedDBAdapter, dhis2.storage.DomLocalStorageAdapter, dhis2.storage.InMemoryAdapter ];
}

dhis2.art.store = new dhis2.storage.Store({
    name: 'dhis2art',
    adapters: [dhis2.storage.IndexedDBAdapter, dhis2.storage.DomSessionStorageAdapter, dhis2.storage.InMemoryAdapter],
    objectStores: ['programs', 'optionSets', 'trackedEntityAttributes', 'attributes', 'dataElements', 'ouLevels']
});

(function($) {
    $.safeEach = function(arr, fn)
    {
        if (arr)
        {
            $.each(arr, fn);
        }
    };
})(jQuery);

/**
 * Page init. The order of events is:
 *
 * 1. Load ouwt
 * 2. Load meta-data (and notify ouwt)
 *
 */
$(document).ready(function()
{
    $.ajaxSetup({
        type: 'POST',
        cache: false
    });

    $('#loaderSpan').show();
});

$(document).bind('dhis2.online', function(event, loggedIn)
{
    if (loggedIn)
    {
        if (dhis2.art.emptyOrganisationUnits) {
            setHeaderMessage(i18n_no_orgunits);
        }
        else {
            setHeaderDelayMessage(i18n_online_notification);
        }
    }
    else
    {
        var form = [
            '<form style="display:inline;">',
            '<label for="username">Username</label>',
            '<input name="username" id="username" type="text" style="width: 70px; margin-left: 10px; margin-right: 10px" size="10"/>',
            '<label for="password">Password</label>',
            '<input name="password" id="password" type="password" style="width: 70px; margin-left: 10px; margin-right: 10px" size="10"/>',
            '<button id="login_button" type="button">Login</button>',
            '</form>'
        ].join('');

        setHeaderMessage(form);
        ajax_login();
    }
});

$(document).bind('dhis2.offline', function()
{
    if (dhis2.art.emptyOrganisationUnits) {
        setHeaderMessage(i18n_no_orgunits);
    }
    else {
        setHeaderMessage(i18n_offline_notification);
    }
});

function ajax_login()
{
    $('#login_button').bind('click', function()
    {
        var username = $('#username').val();
        var password = $('#password').val();

        $.post('../dhis-web-commons-security/login.action', {
            'j_username': username,
            'j_password': password
        }).success(function()
        {
            var ret = dhis2.availability.syncCheckAvailability();

            if (!ret)
            {
                alert(i18n_ajax_login_failed);
            }
        });
    });
}

// -----------------------------------------------------------------------------
// Metadata downloading
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// Metadata downloading
// -----------------------------------------------------------------------------

function downloadMetaData()
{
    console.log('Loading required meta-data');
    var def = $.Deferred();
    var promise = def.promise();

    promise = promise.then( dhis2.art.store.open );
    promise = promise.then( getUserProfile );
    promise = promise.then( getUserAccessiblePrograms );
    promise = promise.then( getUserAccessibleTrackedEntityTypes );
    promise = promise.then( getOrgUnitLevels );
    promise = promise.then( getSystemSetting );

    //fetch programs
    promise = promise.then( getMetaPrograms );
    promise = promise.then( filterMissingPrograms );
    promise = promise.then( getPrograms );

    //fetch option sets
    promise = promise.then( getMetaOptionSets );
    promise = promise.then( filterMissingOptionSets );
    promise = promise.then( getOptionSets );

    //fetch tracked entity attributes
    promise = promise.then( getMetaTrackedEntityAttributes );
    promise = promise.then( filterMissingTrackedEntityAttributes );
    promise = promise.then( getTrackedEntityAttributes );

    //fetch tracker data elements
    promise = promise.then( getMetaDataElements );
    promise = promise.then( filterMissingDataElements );
    promise = promise.then( getDataElements );

    promise.done(function() {
        //Enable ou selection after meta-data has downloaded
        $( "#orgUnitTree" ).removeClass( "disable-clicks" );
        dhis2.tc.metaDataCached = true;
        dhis2.availability.startAvailabilityCheck();
        console.log( 'Finished loading meta-data' );
        selection.responseReceived();
    });

    def.resolve();
}

function getUserProfile(){
    return dhis2.metadata.simpleGet('USER_PROFILE', dhis2.art.apiUrl + '/me.json', 'fields=id,displayName,userCredentials[username]', 'sessionStorage');
}

function getUserAccessiblePrograms()
{
    return dhis2.metadata.getMetaObject(null, 'ACCESSIBLE_PROGRAMS', dhis2.art.apiUrl + '/programs.json', 'fields=id,access[data[write]]&paging=false', 'sessionStorage', dhis2.art.store);
}

function getUserAccessibleTrackedEntityTypes()
{
    return dhis2.metadata.getMetaObject(null, 'ACCESSIBLE_TRACKEDENTITYTYPE', dhis2.art.apiUrl + '/trackedEntityTypes.json', 'fields=id,access[data[write]]&paging=false', 'sessionStorage', dhis2.art.store);
}

function getOrgUnitLevels(){
    dhis2.art.store.getKeys( 'ouLevels').done(function(res){
        if(res.length > 0){
            return;
        }
        return dhis2.metadata.getMetaObjects('ouLevels', 'organisationUnitLevels', dhis2.art.apiUrl + '/organisationUnitLevels.json', 'fields=id,displayName,level&paging=false', 'idb', dhis2.art.store);
    });
}

function getSystemSetting(){
    return dhis2.metadata.simpleGet('SYSTEM_SETTING', dhis2.art.apiUrl + '/systemSettings?key=keyUiLocale&key=keyCalendar&key=keyDateFormat&key=multiOrganisationUnitForms','', 'localStorage');
}

function getMetaTrackedEntityAttributes(){
    return dhis2.metadata.getMetaObjectIds('trackedEntityAttributes', dhis2.art.apiUrl + '/trackedEntityAttributes.json', 'paging=false&fields=id,version');
}

function filterMissingTrackedEntityAttributes( objs ){
    return dhis2.metadata.filterMissingObjIds('trackedEntityAttributes', dhis2.art.store, objs);
}

function getTrackedEntityAttributes( ids ){
    return dhis2.metadata.getBatches( ids, batchSize, 'trackedEntityAttributes', 'trackedEntityAttributes', dhis2.art.apiUrl + '/trackedEntityAttributes.json', 'paging=false&fields=:all,optionSet[id,version],attributeValues[value,attribute[id,name,valueType,code]]', 'idb', dhis2.art.store);
}

function getMetaDataElements(){
    return dhis2.metadata.getMetaObjectIds('dataElements', dhis2.art.apiUrl + '/dataElements.json', 'paging=false&fields=id,version&filter=domainType:eq:TRACKER');
}

function filterMissingDataElements( objs ){
    return dhis2.metadata.filterMissingObjIds('dataElements', dhis2.art.store, objs);
}

function getDataElements( ids ){
    return dhis2.metadata.getBatches( ids, batchSize, 'dataElements', 'dataElements', dhis2.art.apiUrl + '/dataElements.json', 'paging=false&fields=:all,optionSet[id,version],attributeValues[value,attribute[id,name,valueType,code]]', 'idb', dhis2.art.store);
}

function getMetaPrograms(){
    return dhis2.metadata.getMetaObjectIds('programs', dhis2.art.apiUrl + '/programs.json', 'filter=programType:eq:WITH_REGISTRATION&paging=false&fields=id,version');
}

function filterMissingPrograms( objs ){
    return dhis2.metadata.filterMissingObjIds('programs', dhis2.art.store, objs);
}

function getPrograms( ids ){
    return dhis2.metadata.getBatches( ids, batchSize, 'programs', 'programs', dhis2.art.apiUrl + '/programs.json', 'paging=false&fields=*,categoryCombo[id],attributeValues[value,attribute[id,name,valueType,code]],organisationUnits[id,level],programStages[*,programStageDataElements[*,dataElement[id]]]', 'idb', dhis2.art.store, dhis2.metadata.processObject);
}

function getMetaOptionSets(){
    return dhis2.metadata.getMetaObjectIds('optionSets', dhis2.art.apiUrl + '/optionSets.json', 'paging=false&fields=id,version');
}

function filterMissingOptionSets( objs ){
    return dhis2.metadata.filterMissingObjIds('optionSets', dhis2.art.store, objs);
}

function getOptionSets( ids ){
    return dhis2.metadata.getBatches( ids, batchSize, 'optionSets', 'optionSets', dhis2.art.apiUrl + '/optionSets.json', 'paging=false&fields=id,displayName,code,version,valueType,attributeValues[value,attribute[id,name,valueType,code]],options[id,displayName,code]', 'idb', dhis2.art.store, dhis2.metadata.processObject);
}

function getMetaIndicatorGroups(){
    return dhis2.metadata.getMetaObjectIds('indicatorGroups', dhis2.art.apiUrl + '/indicatorGroups.json', 'paging=false&fields=id,version');
}

function filterMissingIndicatorGroups( objs ){
    return dhis2.metadata.filterMissingObjIds('indicatorGroups', dhis2.art.store, objs);
}

function getIndicatorGroups( ids ){
    return dhis2.metadata.getBatches( ids, batchSize, 'indicatorGroups', 'indicatorGroups', dhis2.art.apiUrl + '/indicatorGroups.json', 'paging=false&fields=id,displayName,attributeValues[value,attribute[id,name,valueType,code]],indicators[id,displayName,denominatorDescription,numeratorDescription,dimensionItem,numerator,denominator,annualized,dimensionType,indicatorType[id,displayName,factor,number]]', 'idb', dhis2.art.store, dhis2.metadata.processObject);
}

function getMetaAttributes(){
    return dhis2.metadata.getMetaObjectIds('attributes', dhis2.art.apiUrl + '/attributes.json', 'paging=false&fields=id,version');
}

function filterMissingAttributes( objs ){
    return dhis2.metadata.filterMissingObjIds('attributes', dhis2.art.store, objs);
}

function getAttributes( ids ){
    return dhis2.metadata.getBatches( ids, batchSize, 'attributes', 'attributes', dhis2.art.apiUrl + '/attributes.json', 'paging=false&fields=:all,!access,!lastUpdatedBy,!lastUpdated,!created,!href,!user,!translations,!favorites,optionSet[id,displayName,code,options[id,displayName,code,sortOrder]]', 'idb', dhis2.art.store, dhis2.metadata.processObject);
}
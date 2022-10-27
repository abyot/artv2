
var login = {};
login.localeKey = "dhis2.locale.ui";

var base = "../..";
var apiBase = "https://artpublic.demoinstance.net/";

var mappedDashboard = {};

$(document).ready(function ()
{
    $('#j_username').focus();

    var checked = document.getElementById('2fa').checked;

    $('#2fa').click(function () {
        $('#2fa_code').attr("hidden", checked);
        $('#2fa_code').attr("readonly", checked);
        document.getElementById('2fa').checked = !checked;

        checked = !checked;
    });

    $('#loginForm').bind('submit', function ()
    {
        if (window.location.hash)
        {
            $(this).prop('action', $(this).prop('action') + window.location.hash);
        }

        $('#submit').attr('disabled', 'disabled');

        sessionStorage.removeItem('ouSelected');
        sessionStorage.removeItem('USER_PROFILE');
        sessionStorage.removeItem('USER_SETTING');
        sessionStorage.removeItem('eventCaptureGridColumns');
        sessionStorage.removeItem('trackerCaptureGridColumns');
        sessionStorage.removeItem('trackerCaptureCategoryOptions');
        sessionStorage.removeItem('eventCaptureCategoryOptions');
    });

    var locale = localStorage[login.localeKey];

    if (undefined !== locale && locale)
    {
        login.changeLocale(locale);
        $('#localeSelect option[value="' + locale + '"]').attr('selected', 'selected');
    }

    console.log("Loading public dashboard...");

    Highcharts.setOptions(HighchartTheme);

    var url = apiBase + "api/dashboards.json?filter=publicAccess:eq:r-------&paging=false&fields=id,name,dashboardItems[id,type,shape,x,y,width,height,visualization[id,displayName],map[id,displayName],eventReport[id,displayName],eventChart[id,displayName]]";

    fetch(encodeURI(url)).then(response => {
        return response.json();
    }).then(data => {
        login.fetchPublicDashboard(data);
    });

});

login.fetchPublicDashboard = function (data) {
    if (data && data.dashboards) {
        var dashboardForm =
                '<form class="form-horizontal"> ' +
                '   <div class="form-group"> ' +
                '      	<select class="form-control" id="dashboardList" onchange="login.displaySelectedDashboard();"> ' +
                '          	<option value=""> ' +
                i18n_please_select_dashboard +
                "</option> " +
                "       </select> " +
                "    </div> " +
                "</form>";

        $("#dashboardListForm").append(dashboardForm);

        for (const dashboard of data.dashboards) {
            mappedDashboard[dashboard.id] = dashboard;
            $("#dashboardList").append(
                    $("<option>", {
                        value: dashboard.id,
                        text: dashboard.name,
                        selected: dashboard.id == data.dashboards[0].id,
                    })
                    );
        }

        login.displaySelectedDashboard();
    }
}

login.getItemName = function (obj, key) {
    if (
            obj &&
            obj.metaData &&
            obj.metaData.items &&
            obj.metaData.items[key] &&
            obj.metaData.items[key].name
            ) {
        return obj.metaData.items[key].name;
    }
    return key;
};

login.renderDashboardItem = function (chartType, title, item, data) {
    chartType = chartType.toLowerCase();
    let chartConfig = {
        accessibility: {
            enabled: false,
        },
        title: {
            text: title,
        },
        series: [],
        chart: {
            type: chartType
        }
    };

    if (chartType === "pie") {

        chartConfig.chart.plotBackgroundColor = null;
        chartConfig.chart.plotBorderWidth = null;
        chartConfig.chart.plotShadow = false;

        chartConfig.plotOptions = {
            pie: {
                allowPointSelect: true,
                cursor: "pointer",
                dataLabels: {
                    enabled: true,
                    format: "<b>{point.name}</b>: {point.y} ({point.percentage:.1f} %)",
                },
            },
        };
        let pieSeries = {
            colorByPoint: true,
            data: [],
        };
        for (const row of data.rows) {
            pieSeries.data.push({
                name: login.getItemName(data, row[0]),
                y: Number(row[1]),
            });
        }
        chartConfig.series.push(pieSeries);

        Highcharts.chart(item.id, chartConfig);
    } else if (chartType === "column" || chartType === 'line') {
        chartConfig.plotOptions = {
            column: {
                pointPadding: 0.2,
                borderWidth: 0,
            },
        };

        chartConfig.xAxis = {
            categories: [],
            crosshair: true
        };

        let columnSeries = {};

        for (const row of data.rows) {
            let n = login.getItemName(data, row[0]);
            if (!columnSeries[n]) {
                columnSeries[n] = [];
            }
            columnSeries[n].push(Number(row[2]));
            if (chartConfig.xAxis.categories.indexOf(row[1]) === -1) {
                chartConfig.xAxis.categories.push(row[1]);
            }
        }

        for (const key of Object.keys(columnSeries)) {
            chartConfig.series.push({
                name: key,
                data: columnSeries[key],
            });
        }

        Highcharts.chart(item.id, chartConfig);
    }
};

login.fetchDashboardItemInfo = function (item) {
    let url = apiBase;
    let id = "";
    const dimensionParam =
            "dimension,filter,programStage,items[dimensionItem,dimensionItemType]";
    if (item.type === "CHART" || item.type === "REPORT_TABLE") {
        id = item.visualization.id;
        url +=
                "api/visualizations/" +
                id +
                ".json?fields=id,displayName,type,columns[:all],columnDimensions[:all],filters[:all],rows[:all]";
    } else if (item.type === "EVENT_CHART") {
        id = item.eventChart.id;
        url +=
                "api/eventCharts/" +
                id +
                ".json?fields=id,displayName,type,program,programStage,columns[" +
                dimensionParam +
                "],rows[" +
                dimensionParam +
                "],filters[" +
                dimensionParam +
                "]";
    }

    fetch(encodeURI(url))
            .then((response) => {
                return response.json();
            })
            .then((data) => {
                login.fetchDashboardItemData(item, data);
            });
};

login.getObjectItems = function (obj, prop) {
    let res = [];
    for (const item of obj.items) {
        if (item[prop]) {
            res.push(item[prop]);
        }
    }
    return res;
}

login.fetchDashboardItemData = function (item, data) {
    let dimension = "", filters = "";
    for (const filter of data.filters) {
        filters += "&filter=" + filter.dimension;
        if (filter.items.length > 0) {
            let filterItemsId = login.getObjectItems(filter, 'id');
            let filterDimensionItems = login.getObjectItems(filter, 'dimensionItem');
            if (filterItemsId.length > 0) {
                filters += ':' + filterItemsId.join(';');
            }
            if (filterDimensionItems.length > 0) {
                filters += ':' + filterDimensionItems.join(';');
            }
        }
    }

    for (const col of data.columns) {
        dimension += "dimension=";
        dimension += col.dimension;
        if (col.filter) {
            dimension += ':' + col.filter;
        }

        if (col.items.length > 0) {
            let colItemsId = login.getObjectItems(col, 'id');
            let colDimensionItems = login.getObjectItems(col, 'dimensionItem');
            if (colItemsId.length > 0) {
                dimension += ':' + colItemsId.join(';');
            }
            if (colDimensionItems.length > 0) {
                dimension += ':' + colDimensionItems.join(';');
            }
        }
    }

    for (const row of data.rows) {
        dimension += "&dimension=";
        dimension += row.dimension;

        if (row.filter) {
            dimension += ':' + row.filter;
        }

        if (row.items.length > 0) {
            let rowItemsId = login.getObjectItems(row, 'id');
            let rowDimensionItems = login.getObjectItems(row, 'dimensionItem');
            if (rowItemsId.length > 0) {
                dimension += ':' + rowItemsId.join(';');
            }
            if (rowDimensionItems.length > 0) {
                dimension += ':' + rowDimensionItems.join(';');
            }
        }
    }

    let url = apiBase;
    if (item.type === 'CHART' || item.type === 'REPORT_TABLE') {
        id = item.visualization.id;
        url += 'api/analytics.json?';
    } else if (item.type === 'EVENT_CHART') {
        id = item.eventChart.id;
        url += 'api/analytics/events/aggregate/' + data.program.id + '.json?programStage=' + data.programStage.id + '&';
    }

    url += dimension + filters;

    fetch(encodeURI(url)).then(response => {
        return response.json();
    }).then(analyticsData => {
        login.renderDashboardItem(data.type, data.displayName, item, analyticsData);
    });
}

login.displaySelectedDashboard = function () {

    const dashboardId = $("#dashboardList").val();

    let $div = $("#dashboardItemContainer");
    let $infoDiv = $("#dashboardInfo");

    $div.empty();
    $infoDiv.empty();

    let dashboardItems = {};
    let dashboardItemsScreenShare = {};

    if (dashboardId && mappedDashboard[dashboardId] &&
            mappedDashboard[dashboardId].dashboardItems &&
            mappedDashboard[dashboardId].dashboardItems.length > 0) {
        $.each(mappedDashboard[dashboardId].dashboardItems, function (i, item) {
            if (!dashboardItems[item.y]) {
                dashboardItems[item.y] = [];
                dashboardItemsScreenShare[item.y] = 0;
            }
            dashboardItems[item.y].push(item);
            dashboardItemsScreenShare[item.y] += item.width;
        });
    } else {
        if (dashboardId && dashboardId !== "") {
            $infoDiv.append('<div class="row alert alert-info">' + i18n_selected_dashboard_empty + '</div>');
        }
    }

    let getContainerWidth = function (width, totalSize) {
        return "col-sm-" + Math.round((width / totalSize) * 12);
    }

    if (Object.keys(dashboardItems).length > 0) {

        for (const key in dashboardItems) {
            let sortedDashboardItems = dashboardItems[key].sort((a, b) => (a.x > b.x) ? 1 : -1);
            const totalSize = dashboardItemsScreenShare[key];

            let divContent = '<div class="row add-default-padding">';
            for (const item of sortedDashboardItems) {
                let w = getContainerWidth(item.width, totalSize);
                login.fetchDashboardItemInfo(item);
                divContent += '<div class="' + w + '"><div class="bordered-div"><div id=' + item.id + ' class="dashboard-object-size"></div></div></div>'
            }
            divContent += '</div>';
            $div.append(divContent);
        }
    }

}

login.localeChanged = function ()
{
    var locale = $('#localeSelect :selected').val();

    if (locale)
    {
        login.changeLocale(locale);
        localStorage[login.localeKey] = locale;
    }
}

login.changeLocale = function (locale)
{
    $.get('loginStrings.action?keyApplication=Y&loc=' + locale, function (json) {
        $('#createAccountButton').html(json.create_an_account);
        $('#signInLabel').html(json.sign_in);
        $('#j_username').attr('placeholder', json.login_username);
        $('#j_password').attr('placeholder', json.login_password);
        $('#2fa_code').attr('placeholder', json.login_2fa_code);
        $('#2FaLabel').html(json.login_using_two_factor_authentication);
        $('#forgotPasswordLink').html(json.forgot_password);
        $('#createAccountLink').html(json.create_an_account);
        $('#loginMessage').html(json.wrong_username_or_password);
        $('#poweredByLabel').html(json.powered_by);
        $('#submit').val(json.sign_in);

        $('#titleArea').html(json.applicationTitle);
        $('#introArea').html(json.keyApplicationIntro);
        $('#notificationArea').html(json.keyApplicationNotification);
        $('#applicationFooter').html(json.keyApplicationFooter);
        $('#applicationRightFooter').html(json.keyApplicationRightFooter);
    });
}
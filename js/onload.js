// UI logic and onclick handlers
$(document).ready(function() {
    var credStr = getCookie("credentials");
    
    if (credStr != "") {
        credentials = JSON.parse(credStr);
        initDynamoClient();
    }
    
    //file upload
    $("#importFile").change(function(e) {
        $("#fileDiv").hide();
        var reader = new FileReader();
        reader.onload = onReaderLoad;
        reader.readAsText(e.target.files[0]);
    });

    $(".btnImportOneTable").bind('click', function(evt) {
        importOneTableSchema($("#schema").text());
        $("#oneTableModal").hide();
    });

    $("#btnCreateDocs").bind('click', function(evt) {
        $("#createModelDiv").hide();
        $("#generateDocs").show();
    });

    $("#btnDefineMap").bind('click', function(evt) {
        if ($("#txtMapFunction").val().indexOf("${" + alertData.caller + "}") >= 0) {
            alert("Map Functions cannot reference the destination attribute.");
            return;
        }
        
        var valueTemplate = $("#txtMapFunction").val();
        debugger;
        makeChange();
        createMapping(alertData.data.type, alertData.caller, valueTemplate);
        loadDataModel();

        $("#txtMapFunction").val("");
        $("#lblEditMap").text("Mapping Function:");
        $("#selectTypeDiv").hide();
        $("#defineValueTemplateDiv").hide();
    });

    // generic click handler for Cancel buttons
    $('.cancel').bind('click', function(evt) {
        $(".modal").hide();
        $("#createTableOrIndex").hide();
        $("#createTableOrIndex").hide();
        $("#fileDiv").hide();
        $("#selectTableDiv").hide();
        $("#createModelDiv").hide();
        $("#alertModal").hide();
        $("#removeAttributeModal").hide();
        $("#oneTableModal").hide();
        $("#defineValueTemplateDiv").hide();
        $("#txtMapFunction").val("");
        $("#lblEditMap").text("Mapping Function:");
        $("#selectTypeDiv").hide();
        $("#txtMapFunction").prop("disabled", false);
        $("#btnDefineMap").prop("disabled", false);
        $("#schemaTableDiv").hide();
        $("#modelDiv").hide();
        $("#editDocument").hide();

        initQuery();
    });

    // click handler for Create Model
    $("#btnCreateModel").click(function (evt) {
        // initialize the current model
        model = {};

        // populate metadata from the form and set created timestamp
        model.ModelName = $("#txtModelName").val();
        var date = new Date();
        model.ModelMetadata = {
            "Author": $("#txtModelAuthor").val(),
            "DateCreated": date,
            "DateLastModified": date,
            "Description": $("#txtModelDesc").val()
        };

        // initialize Model change buffer and add a new Table
        tableChanges = {};

        $("#createModelDiv").hide();
        addCollection();
    });

    // hook the onchange event handler for the view table dropdown
    $("#viewTable").change(function (event) {
        $("#selectTableDiv").hide();

        if ($("#viewTable").val() == "-1") {
            // if create table was selected then fire add table dialog
            $("#selectTableDiv").hide();
            addCollection();
        }
        else {
            // set the modelIndex to load
            modelIndex = parseInt($("#viewTable").val());

            // initialize tab index and load the selected data model
            loadDataModel();
        }

        findDataModels();

    });

    
    // click handler for Create Index
    $("#createIndex").find(".btn_create").on('click', function() {
        var definition = {};


        if ($('.indexKeys').val() == '') {
            alert("Please provide the Key Attributes for the index!");
            return;
        }

        definition.KeyAttributes = {};
        definition.IndexName = $('.indexTitle').val();
        
        definition.KeyAttributes = $('.indexKeys').val().replace(", ", ",").split(",");

        makeChange();
        datamodel.SecondaryIndexes.push(definition);
        
        $("#createIndex").find('.key_input').val('');
        $('#createIndex').toggle();

        findDataModels();
        loadDataModel();
    });

    // click handler for Create Table
    $("#createCollection").find(".btn_tablecreate").on('click', function() {
        var definition = {};
        
        $('.primaryKey').val("_id");

        if ($('.collectionTitle').val() == '') {
            alert("Please provide a name for the collection!");
            return;
        }

        definition.KeyAttributes = {};
        definition.CollectionName = $('.collectionTitle').val();

        datamodel = {
            "CollectionName": definition.CollectionName,
            "SecondaryIndexes": [],
            "CollectionData": []
        };

        if (model.DataModel == null)
            model.DataModel = []

        model.DataModel.push(datamodel);
        modelIndex = model.DataModel.length - 1;

        json_data = datamodel.CollectionData;

        table.name = definition.CollectionName;
        table.partition_key = "_id";
        tableChanges[datamodel.CollectionName] = [];
        
        addItem("~new~");
        
        $("#createCollection").find('.key_input').val('');
        $('#createCollection').toggle();

        findDataModels();
        loadDataModel();
    });

    $("#loadModel").on('click', function() {
        $("#mySidenav").css("width","0");
        $("#saveCredsDiv").hide();
        $("#fileDiv").show();
        
        $("#fileType").text("Load Model");
        $("#loadType").text("Select a model:");
        
        alertData.caller = "loadModel";
    });
    
    $("#loadCreds").on('click', function() {
        $("#mySidenav").css("width","0");
        $("#saveCredsDiv").prop('checked', false);
        $("#saveCredsDiv").show();
        $("#fileDiv").show();
        
        $("#fileType").text("Load Credentials");
        $("#loadType").text("Select credentials file:");
        
        alertData.caller = "loadCreds";
    });
    
    $("#saveToTable").on('click', function() {
        alertData.caller = "save";
        $("#lblLoadSave").text("Save to Table");
        $("#mySidenav").css("width","0");
        $("#schemaTableDiv").show();
    });
    
    $("#loadFromTable").on('click', function() {
        alertData.caller = "load";
        $("#selectModel").val("none");
        $("#lblLoadSave").text("Load from Table");
        $("#mySidenav").css("width","0");
        $("#schemaTableDiv").show();
    });

    $(".addGSI").on('click', function() {
        $("#mySidenav").css("width","0");
        $('#createIndex').toggle();
    });

    $("#createModel").on('click', function() {
        $("#mySidenav").css("width","0");
        if (model.ModelName != null) {
            alertData = {
                caller: "createModel",
                data: ""
            };

            $("#alertTitle h1").text("Model Overwrite");
            $("#alertText").text("The existing model will be overwritten, continue?");

            $("#alertModal").show();
        }
        else
            $("#createModelDiv").show();
    });

    $("#saveModel").on('click', function() {
        $("#mySidenav").css("width","0");
        saveModel();
    });

    $("#clearIdx").on('click', function() {
        $("#mySidenav").css("width","0");
        datamodel.GlobalSecondaryIndexes = [];
        loadDataModel();
    });

    $("#importSchema").on('click', function() {
        $("#oneTableModal").show();
    });

    $("#btnSaveDocument").on('click', function() {
        saveDocument();
    });

    $("#showValues").on('click', function(e) {
        showValues = !showValues
        showTable();
        $("#showValuesCheckbox").prop("checked", showValues);
        e.preventDefault()
    });

    $("#showValuesCheckbox").prop("checked", true);

    $("#exportSchema").on('click', function() {
        $("#mySidenav").css("width","0");
        exportOneTableSchema();
    });

    $("#reload").on('click', function() {
        location.reload();
    });
});
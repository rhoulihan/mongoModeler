// Utility method to escape characters in an element id that will mess with jquery
function jq( myid ) {
    return (myid.startsWith("#") ? "" : "#") + myid.replace( /(:|\.|\||\[|\]|,|=|@|#|~|!)/g, "\\$1" );
}

// passthrough method to fire keypress event when an editable div loses focus
function focusOut(id) {
    if (!fired)
        $(jq(id)).triggerHandler("keypress");

    fired = false;
}

// update a partition key value
function updatePK(id) {
    var keycode = (event.keyCode ? event.keyCode : event.which);

    // if this is an enter or null key event then process the cell text
    if(keycode == '13' || keycode == '0') {
        // set keypress event flag
        fired = true;

        // cancel the carriage return
        event.preventDefault();

        // get the new value, if its different than the old key then process it
        var newVal = $(jq(id)).text();

        if (newVal.localeCompare(cellId[id].PK) == 0)
            return;

        if (!testForDuplicateId(newVal)) {
            // snapshot the model state
            makeChange();
            var first = {};
            // find the Document in this Collection and update the _id value
            $.each(json_data, function(idx, obj) {
                if ( obj[table.primary_key] == cellId[id].PK) {
                    obj[table.primary_key] = newVal;
                    
                    if (jQuery.isEmptyObject(first))
                        first = obj;
                }
            });

            // update the cell metadata
            cellId[id].PK = newVal;
            selectId = cellId["cell" + (parseInt(id.substr(4)) + 1)];
            selectId.PK = newVal;
            selectId.obj = first;
        }
    
        // refresh the table view
        loadDataModel();
    }
}

function editDocument(id) {
    delete cellId[id].obj.dispVals;
    jsonEditor = new JsonEditor("#documentJSON", cellId[id].obj);
    $("#editDocument").toggle();
}

function saveDocument() {
    var editDoc = {},
        repDoc = {},
        deletedAttrs = [],
        newAttrs = [];

    try {
        editDoc = jsonEditor.get();
        $("#editDocument").toggle();
    } catch {
        alert("Parsing error. Valid JSON text required.");
        return;
    }
    
    makeChange();

    json_data.forEach(function (doc, index) {
        if (editDoc["_id"] === doc["_id"]) {
            repDoc = doc;
            return false;
        }
    });

    if (repDoc["type"].localeCompare(editDoc["type"]) != 0) {
        //remove existing attributes
        for (var key in repDoc) {
            if (key.localeCompare("_id") != 0)
                delete repDoc[key];
        };

        // add attributes for existing type or create new model
        if (schema.models.hasOwnProperty(editDoc["type"])) {
            repDoc["type"] = editDoc["type"];
            for (var prop in schema.models[newVal]) {
                let props = ['type', "_id"];
                if (!props.includes(prop)) {
                    repDoc[prop] = '~new~';
                }
            };
        } else {
            for (var key in editDoc) {
                if (key.localeCompare("_id") != 0) {
                    repDoc[key] = editDoc[key];
                }
            };
            addEntityToSchema(repDoc);
        }
    } else {
        var model = schema["models"][editDoc["type"]];
    
        //find changes
        for (var key in repDoc) {
            if (Object.keys(editDoc).includes(key)) {
                repDoc[key] = editDoc[key];
            } else {
                deletedAttrs.push(key);
                delete repDoc[key];
            }
        };
    
        for (var key in editDoc) {
            if (!Object.keys(repDoc).includes(key)) {
                repDoc[key] = editDoc[key];
                newAttrs.push(key);
            }
        };
    }
    
    if (newAttrs.length == 0 && deletedAttrs.length == 0) {
        loadDataModel();
    } else {
        alertData["caller"] = "saveDocument";
        alertData["data"] = {};
        alertData["data"]["newAttrs"] = newAttrs;
        alertData["data"]["deletedAttrs"] = deletedAttrs;
        alertData["data"]["type"] = repDoc["type"];
        alertData["data"]["callerId"] = repDoc["_id"];

        $("#schemaChangeText").text(`Apply schema changes to all documents of the '${alertData.data.type}' type?`);
    
        $("#schemaChangeModal").show();
    }
}

function addItemClick(id) {
    pasteItem = {};
    addItem(id);
}

function testForDuplicateId(_id) {
    let dup = false
    json_data.forEach(function(obj) {
        if (obj["_id"].localeCompare(_id) == 0) {
            alert("Duplicate _id value detected.");
            dup = true;
            return false;
        }
    });

    return dup;
}

// add a new item to the table
function addItem(id) {
    // build the new item
    var newItem = Object.keys(pasteItem).length > 0 ? JSON.parse(JSON.stringify(pasteItem)) : {};

    newItem["_id"] = "~new~";
    newItem["type"] = "~new~";

    if (testForDuplicateId(newItem["_id"]))
        return;

    // snapshot model state
    makeChange();

    // add "type" as a non-key attribute
    addModelAttribute(null, 'type');
    json_data.push(newItem);

    // refresh the table view
    showValues = true;
    loadDataModel();
}

// add a non-key attribute to the model if it does not already exist
function addModelAttribute(type, attribute) {
    // add this attribute to the schema
    if (type && !schema.models[type][attribute]) {
        schema.models[type][attribute] = { type: 'String' }
    }
}

function findModel(id) {
    let type = findType(id)
    return schema.models.find(m => m.type == type)
}

function findType(id) {
    return cellId[id].type
}

// add an attribute to an Item. Note: this does not change the schema until an attibute name is assigned.
function addAttribute(id, name) {
    // find the backing object for this Item
    let obj = cellId[id].obj;
    
    // if the object has a "type" attribute that is unset then throw an alert and bail
    if (obj.hasOwnProperty("type") && obj.type == "~new~") {
        alert("You need to assign this object a type before adding new attributes.");

        // set the selectId attribute to focus on the type attribute for this item when the table renders and bail out
        selectId.attr = "type";
    } else {
        // snapshot the model state and add a new attribute to the Item
        makeChange();
        obj[name] = "~new~";
    }

    // refresh the table view
    showValues = true;
    loadDataModel();
}

// assign a name to a new attribute
function nameAttribute(id) {
    var keycode = (event.keyCode ? event.keyCode : event.which);

    // process the name change if this is an enter or null key
    if(keycode == '13' || keycode == '0' || selectId.hasOwnProperty("attrName")) {
        // cancel keypress
        event.preventDefault();

        // find the attribute name
        var attribute = selectId.hasOwnProperty("attrName") ? selectId.attrName : $(jq(id)).text(),
            type = {};
        
        delete selectId.attrName;

        // find the backing object for the Item
        let obj = cellId[id].obj;
        
        // if the property already exists then bail out
        if (obj.hasOwnProperty(attribute)) {
            return false;
        }
        // add the non-key attribute defintion
        addModelAttribute(obj.type, attribute)
        
        // swap the value into the new attribute and delete the placeholder
        obj[attribute] = obj["~new~"];
        delete obj["~new~"];
        selectId = {
            PK: obj[table.primary_key],
            attr: attribute,
            obj: obj
        };

        // add this attribute to other objects of this type
        if (obj.hasOwnProperty("type")) {
            $.each(json_data, function (idx, obj1) {
                if (obj.type == obj1.type)
                    obj1[attribute] = "~new~";
            });
        }

        // if the object had a type then add attribute to other objects of this type
        if (Object.keys(type).length > 0) {
            $.each(json_data, function (idx, obj) {
                if (obj["type"] == type)
                    obj[attribute] = "~new~";
            });
        }

        // refresh the table view
        loadDataModel();
    }
}

function importOneTableSchema(text) {
    schema = JSON.parse(text);
    if (!schema.models) {
        alert('Invalid OneTable schema. Missing top level models.')
        return
    }
    model = {};

    for (let [indexName, index] of Object.entries(schema.indexes)) {
        var def = {};
        def.KeyAttributes = {};
        def.KeyAttributes.PartitionKey = {
            'AttributeName': index.hash,
            'AttributeType': 'S'
        };
        def.KeyAttributes.SortKey = {
            'AttributeName': index.sort,
            'AttributeType': 'S'
        };
        def.NonKeyAttributes = [];
        def.TableData = [];

        if (!model.hasOwnProperty("DataModel")) {
            modelIndex = 0;
            model.DataModel = [];
            def.GlobalSecondaryIndexes = [];
            def.TableName = indexName;
            tableChanges[indexName] = [];
            model.DataModel.push(def);
            table = {
                name: indexName,
                primary_key: def.KeyAttributes.PartitionKey.AttributeName,
                sort_key: def.KeyAttributes.SortKey.AttributeName,
                sortkey_datatype: def.KeyAttributes.SortKey.AttributeType
            };
            json_data = def.TableData;
        } else {
            def.IndexName = indexName;
            def.Projection = { ProjectionType: "ALL" };
            model.DataModel[modelIndex].GlobalSecondaryIndexes.push(def);
        }
    }
    modelIndex = 0;
    datamodel = model.DataModel[modelIndex];

    for (let [modelName, model] of Object.entries(schema.models)) {
        for (let [name, field] of Object.entries(model)) {
            if (field.value) {
                if (!schema.indexes[name]) {
                    let item = datamodel.NonKeyAttributes.find(a => a.AttributeName == name);
                    if (!item) {
                        item = {
                            AttributeName: name,
                            AttributeType: typeToDynamo(field.type),
                        }
                        datamodel.NonKeyAttributes.push(item);
                    }
                }
            }
        }
        //  Define type attribute (OneTable does this automatically)
        if (!schema.models[modelName]) {
            schema.models[modelName].type = { type: 'String', required: true, value: modelName };
        }
    }

    if (schema.data) {
        let item = {};
        for (let row of schema.data) {
            item = {};
            for (let [key, value] of Object.entries(row)) {
                item[key] = { 'S': value };
            }
            json_data.push(item);
        }
        expandValueTemplates();
        showTable();
    } else {
        addItem("~new~");
    }
}

function exportOneTableSchema() {
    let output = Object.assign({}, schema, {data: []})
    let data = output.data
    for (let row of json_data) {
        let item = {}
        for (let [key, value] of Object.entries(row)) {
            item[key] = Object.values(value)[0]
        }
        data.push(item)
    }
    save(JSON.stringify(output, null, 4), "schema.json", "json");
}

function setAttributeType(type, item, attr) {

    switch (type) {
        case "Number":
            if ( isNaN(item[attr]) ) 
                item[name] = {
                    "N": "0"
                }
            else
                item[name] = {
                    "N": item[attr]
                }
            break;
            
        case "Boolean":
            item[attr] = {
                "BOOL": item[attr].toLowerCase() == "false" || item[attr] == "0" ? false : !item[attr]
            };
            break;
            
        default:
            let newAttr = {};
            newAttr[types[type]] = item[attr];
            item[attr] = newAttr;
            break;
    }
}

// set an attribute value
function setValue(id) {
    // get the new value for the attribute and split out the key values and attribute name
    var newVal = $(jq(id)).text(),
        PK = cellId[id].PK,
        SK = cellId[id].SK,
        name = cellId[id].attr,
        change = true,
        obj = cellId[id].obj;

    // if the value is uninitialized
    if (newVal == "~new~")
        return;
        
    let entity = schema.models[obj.type]
    let field = {
        type: "String"
    }
    
    if (entity)
        field = entity[name];
    
    if (!showValues) {
        //  Editing meta view, so update the type or value template where appropriate
        if (name == 'type') {
            if (obj.type == newVal)
                return;
            
            showValues = true;
            setValue(id);
            showValues = false;
        } else {
            
            if (newVal == field.type || newVal == field.value)
                return;
            
            makeChange();
            if (Object.keys(types).includes(newVal)) {
                $.each(json_data, function(idx, item) {
                    setAttributeType(newVal, item, name);
                });
                
                field.type = newVal    
            } else {
                field.value = newVal
            }
        }
        
        loadDataModel();
    } else {
        // if the value has changed then process it
        if (obj[name] != newVal) {
            if ( cellId.hasOwnProperty("cell" + (parseInt(id.substr(4)) + 1)))
                selectId = cellId["cell" + (parseInt(id.substr(4)) + 1)];
            else
                selectId = cellId["cell1"];

            // snapshot model state and apply the change
            makeChange();
            obj[name] = newVal;

            // if this is a type change then adjust the attributes accordingly
            if (name == "type") {
                //remove existing attributes
                $.each(Object.keys(obj), function (idx, key) {
                    if (key != table.primary_key && key != "type")
                        delete obj[key];
                });

                // add attributes for new type with default value
                if (schema.models.hasOwnProperty(newVal)) {
                    $.each(schema.models[newVal], function(prop, field) {
                        let props = ['type', table.primary_key];
                        if (!props.includes(prop)) {
                            obj[prop] = '~new~';
                        }
                    });
                } else {
                    addEntityToSchema(obj);
                }
            }

            // refresh the table view
            loadDataModel();
        }
    }
}

// update an Item attribute with a new value
function updateItem(id) {
    var keycode = (event.keyCode ? event.keyCode : event.which);

    // if this is an enter or null key code then process new value
    if(keycode == '13' || keycode == '0') {
        event.preventDefault();

        // set keypress event flag
        fired = true;
        mouseDown = false;
        setValue(id);
    }
}

// remove all items from a partition
function deletePartition(id) {
    if (cellId[id].obj[table.primary_key] == "~new~") {
        alert("New partitions cannot be deleted.");
        return;
    }

    alertData = {
        caller: "deletePartition",
        data: cellId[id].obj[table.primary_key]
    };

    $("#alertTitle h1").text("Delete Document");
    $("#alertText").text(`The '${alertData.data}' document will be deleted, continue?`);

    $("#alertModal").show();
}

// remove an item from the model
function deleteItem(id) {
    alertData = {
        caller: "deleteItem",
        data: id
    };

    var PK = cellId[id].obj[table.primary_key],
        SK = cellId[id].obj[table.sort_key],
        message = "";

    if (PK == "~new~")
        message = "Items cannot be deleted from new partitions.";

    if ( message != "") {
        loadDataModel();
        return;
    }

    $("#alertTitle h1").text("Delete Item");
    $("#alertText").text(`Item key '${PK}, ${SK}' will be deleted, continue?`);

    $("#alertModal").show();
}

// refresh the table view
function showTable() {
    // reset the table display
    $("#primary_table").html('');

    // build the table html
    makeTable(table);

    // build the HTML and add a tab for each index
    $.each(datamodel.SecondaryIndexes, function(index, gsi) {
        makeIndex(gsi);
    });

    $("#aboutDiv").hide();
    $("#tabDiv").show();
    $("#tabs").show();
    $("#fileDiv").hide();
    $("#tableDivButton").className += " active";

    $(".tabable").mousedown(function(eventData) {
        var id = $(this).attr("id");
        selectId = cellId[id];
        mouseDown = true;
        if (eventData.which === 3) {
            $(jq(id)).selectText(parseInt(id.substr(4)));
        }
    });
}

function makeDocuments(spec) {
    // Instantiate Chance so it can be used
     var chance = new Chance(),
         docs_toinsert=[];
     
     for (var i = 0; i < spec.numDocs || 10; i++) {
        var doc = {};
       
        Object.keys(spec.doc).map(key => {
           doc[key] =  getAttrValue(spec.doc[key], spec.options);
        });

       docs_toinsert.push(doc);
     }
     
   
    return docs_toinsert;
}

function   getAttrValue(field, options) {
    if (Array.isArray(field)) {
        var curarr = [],
            upperLimit = parseInt(Object.keys(field[0])[0]);

        for (var item=0; item < upperLimit; item++) {
          field.map(key => {
            curarr.push(getAttrValue(key[upperLimit.toString()],options));
          });
        }
        
        return curarr;
    }

    if (typeof field == "object") {
        var curObj = {}
        
        Object.keys(field).map(key => {
            curObj[key] =  getAttrValue(field[key], options);
         });

        return curObj;
    }
      
    field = field.toLowerCase();
    switch (field) {
        case 'objectid':
            return new BSON.ObjectId();
        
        case 'date':
            return new Date(chance.date(options[field] || {year: 2022}));
        
        case 'geo':
            return { type: "Point", coordinates: [ chance.longitude(options[field] || undefined), chance.latitude(options[field] || undefined) ] };
        
        default:
            return chance[field](options[field] || undefined);
        
    }
}

// generate the HTML for the table
function makeTable(table) {
    // sort the documents
    // sortObjectList();

    // generate HTML for the _id Index Tab
    var html = '<thead tabindex="-1"><tr tabindex="-1"><th tabindex="-1" colspan="2" style="text-align: center; width: 40%;"><div>Index Key<div tabindex="-1" class="bottomright noselect"><input tabindex="-1" onclick="addItemClick(\'\')" type="image" src="./img/add.png" title="Add Document" style="cursor:pointer; background:transparent; float:right; border:0; outline:none;" border = 0 width="20" height="20"></div></div></th>'; 
    
    
    html += generate(true, ["_id"]);

    // add generated HTML to the primary_table element and set titles and styles
    $("#primary_table").html(html);
    $(".basetable_title").text(table.name);
    $(".tablediv").css('display', '-webkit-box');
    $(".classprimaryKey").css('width', '400');


    // focus the first cell or selected object
    var focusCell = selectId == null || Object.keys(selectId).length == 0 ? boundary.first : selectId;
    $.each(cellId, function(prop, val) {
        if (val.PK == focusCell.PK && val.SK == focusCell.SK && val.attr == focusCell.attr) {
            $(jq(prop)).trigger("focus");
            return false;
        }
    });

    // remove all index tab content
    $.each($(".tabcontent"), function (idx, obj) {
        if (obj.id != "tablediv") {
            $(jq(obj.id)).remove();
        }
    });

    // remove index tab buttons
    $.each($(".tablinks"), function (idx, obj) {
        if (obj.id != "tableDivButton")
            $(jq(obj.id)).remove();
    });
}

// generate the HTML and construct the tab element for an index
function makeIndex(index) {
    // group and sort the object list
    // sortObjectList();

    // set base element name
    var element = "#" + index.IndexName;

    // if this tab already exists then remove it
    if ($(element + "_tab").length)
        $(element + "_tab").remove();

    // generate the HTML for this index
    var html = '<div tabindex="-1" id="' + index.IndexName + '_tab" class="tabcontent">', 
        colspan = index.KeyAttributes.length;

    if (colspan < 2)
        colspan = 2;

    html += '<table tabindex="-1"><thead tabindex="-1"><tr tabindex="-1"><th tabindex="-1" colspan=' + colspan + '>Index Keys</th>';
    html += generate(false, index.KeyAttributes);
    html += "</div>";

    // add the html to the tab control
    $("#tabs").append(html);

    // if the button for this index tab exists then remove it
    if ($(element + "_btn").length)
        $(element + "_btn").remove();

    // build the button for the HTML and add it to the tab control
    html = '<button tabindex="-1" id="'+ index.IndexName + '_btn" class="tablinks" style="display:inline" onclick="showTab(event, \'' + index.IndexName + '_tab\')"><h2>' + index.IndexName + '</h2></button>'
    $("#tabDiv").append(html);
}

function expandDocuments(sortKeys) {
    let sortData = [];

    json_data.forEach(function (document) {
        expand(document, sortKeys, sortData);
    });

    switch (sortKeys.length) {
        case 1:
            sortData = sortData.sort((a,b) => (a["dispVals"][sortKeys[0]] > b["dispVals"][sortKeys[0]] ? 1 : a["dispVals"][sortKeys[0]] < b["dispVals"][sortKeys[0]] ? -1 : 0))
            break;

        case 2:
            sortData = sortData.sort((a,b) => 
            (a["dispVals"][sortKeys[0]] > b["dispVals"][sortKeys[0]] ? 1 : a["dispVals"][sortKeys[0]] < b["dispVals"][sortKeys[0]] ? -1 : 0) || 
            (a["dispVals"][sortKeys[1]] > b["dispVals"][sortKeys[1]] ? 1 : a["dispVals"][sortKeys[1]] < b["dispVals"][sortKeys[1]] ? -1 : 0));
            break;
        
        case 3:
            sortData = sortData.sort((a,b) => 
            (a["dispVals"][sortKeys[0]] > b["dispVals"][sortKeys[0]] ? 1 : a["dispVals"][sortKeys[0]] < b["dispVals"][sortKeys[0]] ? -1 : 0) || 
            (a["dispVals"][sortKeys[1]] > b["dispVals"][sortKeys[1]] ? 1 : a["dispVals"][sortKeys[1]] < b["dispVals"][sortKeys[1]] ? -1 : 0) || 
            (a["dispVals"][sortKeys[2]] > b["dispVals"][sortKeys[2]] ? 1 : a["dispVals"][sortKeys[2]] < b["dispVals"][sortKeys[2]] ? -1 : 0));
            break;
        
        case 4:
            sortData = sortData.sort((a,b) => 
            (a["dispVals"][sortKeys[0]] > b["dispVals"][sortKeys[0]] ? 1 : a["dispVals"][sortKeys[0]] < b["dispVals"][sortKeys[0]] ? -1 : 0) || 
            (a["dispVals"][sortKeys[1]] > b["dispVals"][sortKeys[1]] ? 1 : a["dispVals"][sortKeys[1]] < b["dispVals"][sortKeys[1]] ? -1 : 0) || 
            (a["dispVals"][sortKeys[2]] > b["dispVals"][sortKeys[2]] ? 1 : a["dispVals"][sortKeys[2]] < b["dispVals"][sortKeys[2]] ? -1 : 0) || 
            (a["dispVals"][sortKeys[3]] > b["dispVals"][sortKeys[3]] ? 1 : a["dispVals"][sortKeys[3]] < b["dispVals"][sortKeys[3]] ? -1 : 0));
            break;
        
        case 5:
            sortData = sortData.sort((a,b) => 
            (a["dispVals"][sortKeys[0]] > b["dispVals"][sortKeys[0]] ? 1 : a["dispVals"][sortKeys[0]] < b["dispVals"][sortKeys[0]] ? -1 : 0) || 
            (a["dispVals"][sortKeys[1]] > b["dispVals"][sortKeys[1]] ? 1 : a["dispVals"][sortKeys[1]] < b["dispVals"][sortKeys[1]] ? -1 : 0) || 
            (a["dispVals"][sortKeys[2]] > b["dispVals"][sortKeys[2]] ? 1 : a["dispVals"][sortKeys[2]] < b["dispVals"][sortKeys[2]] ? -1 : 0) || 
            (a["dispVals"][sortKeys[3]] > b["dispVals"][sortKeys[3]] ? 1 : a["dispVals"][sortKeys[3]] < b["dispVals"][sortKeys[3]] ? -1 : 0) || 
            (a["dispVals"][sortKeys[4]] > b["dispVals"][sortKeys[4]] ? 1 : a["dispVals"][sortKeys[4]] < b["dispVals"][sortKeys[4]] ? -1 : 0));
            break;
    } 

    return sortData;
}

function expand(document, sortKeys, exDocs) {
    let insertDoc = true;

    if (!document.hasOwnProperty("dispVals") || "~new~".localeCompare(document.dispVals) == 0) {
        document.dispVals = {};
    }

    sortKeys.forEach(function (key, keyIdx) {
        let path = key.split("."),
            value = document[path[0]];

        for (let i = 0; i < path.length; i++) {
            if (i > 0 && path.length > 1)
                value = value[path[i]];
            
            if (Array.isArray(value)) {
                if (!insertDoc)
                    break;

                insertDoc = false;
                
                value.forEach(function (val) {
                    let newDoc = JSON.parse(JSON.stringify(document));

                    switch (i) {
                        case 0:
                            newDoc[path[0]] = val;
                            break;

                        case 1:
                            newDoc[path[0]][path[1]] = val;
                            break;

                        case 2:
                            newDoc[path[0]][path[1]][path[2]] = val;
                            break;

                        case 3:
                            newDoc[path[0]][path[1]][path[2]][path[3]] = val;
                            break;

                        case 4:
                            newDoc[path[0]][path[1]][path[2]][path[3]][path[4]] = val;
                            break;
                    }

                    expand(newDoc, sortKeys, exDocs);
                });
            } else {
                
                if (typeof value === 'undefined' || !insertDoc) {
                    insertDoc = false;
                    return;
                }

                if (path.length > i + 1 && typeof value != 'object') {
                    insertDoc = false;
                    return;
                }

                if (i + 1 == path.length) {
                    document.dispVals[key] = getDispVal(value);

                    if (sortKeys.length == keyIdx + 1) {
                        exDocs.push(document);
                        insertDoc = false;
                    }
                }
            }
        }
    });
}

function pushDoc() {

}

function getDispVal(value) {
    switch (typeof value) {
        case 'object':
            return JSON.stringify(value);
            break;

        case 'number':
            return value.toString();
            break;

        default:
            return value;
            break;
    }
}

function buildBtreeView(rowData, sortKeys) {
    let btreeMap = {};
    rowData.forEach(function (row) {
        let mapVal = btreeMap;
        sortKeys.forEach(function (key, index) {
            if (index > 0) {
                let rowVal = row;

                key.split(".").forEach(function (subKey) {
                    rowVal = rowVal[subKey];
                });

                rowVal = getDispVal(rowVal);

                if (!mapVal.hasOwnProperty(rowVal)) {
                    mapVal[rowVal] = { "span": 0 };
                }

                mapVal = mapVal[rowVal];
                mapVal.span += 2;
            }
        });
    });

    return btreeMap;
}

// build the html for a table or index view
function generate(isCollection, sortKeys) {
    // container for sort row html
    var sortHtml = '',
        maxLength = 0;
    // column span for partition key column
    var primaryColSpan = 1;

    // Add sort key to table header if it exists
    if (sortKeys.length > 1) {
        sortKeys.forEach(function(item, index) {
            if (index > 0) {
                sortHtml += '<th tabindex="-1" class="key_cell">' + item + '</th>';
            }
        });
    } else {
        primaryColSpan = 2;
    }

    // set the tab index
    tabIndex = 1;
    // Build a row for each Item in the TableData array
    var rowHtml = '';

    sortData = expandDocuments(sortKeys);

    // find the max length of all rows to calculate cell width
    $.each(sortData, function(index, object) {
        addEntityToSchema(object);
        // Record max width for the table
        if (maxLength < Object.keys(object).length)
            maxLength = Object.keys(object).length;
    });

    $.each(sortObjectList(isCollection, sortKeys[0], sortData), function(index, documentArray) {

        var tbodyHtml = '',
            PK = '',
            SK = '',
            dispVal = '',
            id = '';

        keyMap = buildBtreeView(documentArray, sortKeys);

        $.each(documentArray, function(count, document) {
            tbodyHtml = '<tr>';

            let type = (document && document.type) ? document.type : null;
            let entity = type ? schema.models[type] : null;

            // If its the first cell insert the primary key value and span all the rows for the objects in this partition otherwise skip
            if (count == 0) {
                PK = document["dispVals"][sortKeys[0]];
                dispVal = PK;
    

                // if this is the _id index then document data is editable
                if (isCollection) {
                    id = "cell" + tabIndex;
                    
                    // if this is a new document then set the focus on it when the table renders
                    if (PK == "~new~")
                        selectId = {
                            PK: "~new~",
                            attr: sortKeys[0]
                        };

                    if (!boundary.first.hasOwnProperty("PK"))
                        boundary.first = {
                            PK: PK,
                            attr: sortKeys[0]
                        };

                    cellId[id] = {
                        PK: PK,
                        attr: sortKeys[0],
                        type: type,
                        obj: document
                    }

                    // wrap the primary key value in a contenteditable div using the cellId value as element id and hook the relevant handlers
                    dispVal = buildKeyCell(id, sortKeys[0], sortKeys);
                }

                // add the cell to the row
                tbodyHtml += '<td class="td_key" rowspan="' + documentArray.length * 2 + '" colspan="' + primaryColSpan + '">' + dispVal + '</td>';
            }

            // Insert sort key values for the Item
            let vals = {};
            sortKeys.forEach(function(key, index) {
                if (index == 0) {
                    return true;
                }

                id = "cell" + tabIndex;
                if (!showValues && entity) {
                    if (entity[key]) {
                        SK = dispVal = entity[key].value || entity[key].type;
                    } else {
                        SK = document["dispVals"][key];
                    }
                } else {
                    SK = document["dispVals"][key];
                    // set the default display value
                    dispVal = SK.startsWith("~new~") ? "~new~" : SK;
                }

                let path = key.split(".")
                    val = document[path[0]];

                for (i = 1; i < path.length; i++) {
                    val = val[path[i]];
                }

                val = getDispVal(val);
                
                if (!vals.hasOwnProperty(key))
                    vals[key] = [];
                
                vals[key].push(val);

                switch (index) {
                    case 1:
                        if (!keyMap[val].hasOwnProperty("isGenerated")) {
                            tbodyHtml += '<td class="td_key" rowspan="' + keyMap[val]["span"] + '">' + dispVal + '</td>';
                            keyMap[val]["isGenerated"] = true;
                        }
                        break;
                    
                    case 2:
                        if (!keyMap[vals[sortKeys[1]][0]][val].hasOwnProperty("isGenerated")) {
                            tbodyHtml += '<td class="td_key" rowspan="' + keyMap[vals[sortKeys[1]][0]][val]["span"] + '">' + dispVal + '</td>';
                            keyMap[vals[sortKeys[1]][0]][val]["isGenerated"] = true;6
                        }
                        break;

                    case 3:
                        if (!keyMap[vals[sortKeys[1]]][vals[sortKeys[2]]][val].hasOwnProperty("isGenerated")) {
                            tbodyHtml += '<td class="td_key" rowspan="' + keyMap[vals[sortKeys[1]]][vals[sortKeys[2]]][val]["span"] + '">' + dispVal + '</td>';
                            keyMap[vals[sortKeys[1]]][vals[sortKeys[2]]][val]["isGenerated"] = true;
                        }
                        break;
                    
                    case 4:
                        if (!keyMap[vals[sortKeys[1]]][vals[sortKeys[2]]][vals[sortKeys[3]]][val].hasOwnProperty("isGenerated")) {
                            tbodyHtml += '<td class="td_key" rowspan="' + keyMap[vals[sortKeys[1]]][vals[sortKeys[2]]][vals[sortKeys[3]]][val]["span"] + '">' + dispVal + '</td>';
                            keyMap[vals[sortKeys[1]]][vals[sortKeys[2]]][vals[sortKeys[3]]][val]["isGenerated"] = true;
                        }
                        break;
                    
                    case 5:
                        if (!keyMap[vals[sortKeys[1]]][vals[sortKeys[2]]][vals[sortKeys[3]]][vals[sortKeys[4]]][val].hasOwnProperty("isGenerated")) {
                            tbodyHtml += '<td class="td_key" rowspan="' + keyMap[vals[sortKeys[1]]][vals[sortKeys[2]]][vals[sortKeys[3]]][vals[sortKeys[4]]][val]["span"] + '">' + dispVal + '</td>';
                            keyMap[vals[sortKeys[1]]][vals[sortKeys[2]]][vals[sortKeys[3]]][vals[sortKeys[4]]][val]["isGenerated"] = true;
                        }
                        break;
                }
            });


            // build header and value rows for the Item
            var header = '';
            var row = '';
            $.each(document, function(name, value) {
                id = "cell" + tabIndex;
                if (sortKeys.includes(name) || name.localeCompare("dispVals") == 0)
                    return true;

                // start building the header cell
                header += '<td class="grey-header">'
                var tail = "";

                // if this is a new attribute then it needs to be editable
                if (isCollection && name == "~new~") {
                    cellId[id] = {
                        PK: document["dispVals"][sortKeys[0]],
                        attr: "new",
                        type: type,
                        obj: document
                    }

                    // store attribute name cell id in the focus pointer
                    selectId = cellId[id];

                    // wrap the attribute name in a contenteditable div and hook the relevant event handlers
                    header += '<div id="' + id + '" class="tabable tab' + tabIndex + ' attribute-context-menu" tabindex="0" onfocus="$(\'' + id + '\').selectText(' + tabIndex++ + ')" onfocusout="focusOut(\'' + id + '\')" onkeypress="nameAttribute(\'' + id + '\')" contenteditable>';
                    tail = "</div>";
                }

                // finish the header cell
                header += name + tail + '</td>';

                
                if (isCollection) {
                    id = "cell" + tabIndex;
                    cellId[id] = {
                        PK: PK,
                        attr: name,
                        type: type,
                        obj: document
                    }

                    boundary.last = cellId[id];
                }

                delete document["dispVals"];

                // if this is not a map attribute then add the value cell
                if (typeof value === 'object' || Array.isArray(value)) {
                    let linkText = ">{...}</td>";
                    if (Array.isArray(value)) {
                        linkText = ">[...]</td>"
                    }
                    // link the map editor in the value cell
                    if (isCollection) {
                        row += '<td onclick="editDocument(\'' + id + '\')" style="text-align: center; cursor: zoom-in;" class="tabable tab' + tabIndex++ + '" tabindex="0"  rel=' + (vals.length - 1) + linkText;
                    } else {
                        row += "<td" + linkText;
                    }
                } else {
                    if (!showValues && entity && entity[name]) {
                        if (name == 'type') {
                            dispVal = value;
                        } else {
                            dispVal = entity[name].value || entity[name].type || value;
                        }
                    } else {
                        dispVal = value;
                        if (dispVal == '~new~' && entity && entity[name] && entity[name].default) {
                            displVal = entity[name].default
                        }
                    }
                    if (isCollection) {
                        dispVal = '<div id="' + id + '" class="tabable cell-context-menu tab' + tabIndex + '" tabindex="0" onfocus="$(\'' + jq(jq(id)) + '\').selectText(' + tabIndex++ + ')" onfocusout="focusOut(\'' + id + '\')" onkeypress="updateItem(\'' + id + '\')" contenteditable>' + dispVal + '</div>';
                    }
                    row += '<td>' + dispVal + '</td>';
                }
            });

            // finish the header/value rows and add them to the Item row
            header += '</tr>';
            row += '</tr>';
            tbodyHtml += header;
            tbodyHtml += row;

            //Add the Item row to the Item row collection HTML
            rowHtml += tbodyHtml;
        });
    });

    // add the undo button if this is the table view
    var backDiv = "";
    if (isCollection) {
        backDiv = '<input tabindex="-1" onclick="undoChange(\'\')" type="image" src="./img/back.png" title="Undo Change" style="cursor:pointer; background:transparent; float:right; border:0; outline:none;" border = 0 width="20" height="20">';
    }

    // build the table HTML
    var html = '<th id="attrHead" rowspan="2" colspan="' + maxLength + '">Attributes' + backDiv + '</th></tr>';
    html += '<tr><th class="key_cell" colspan="' + primaryColSpan + '">' + sortKeys[0] + '</th>';
    html += sortHtml + '</tr></thead><tbody>';
    html += rowHtml;
    html += "</tbody>";

    return html;
}

function isJson(str) {
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    return true;
}

// create the HTML for the controls in a key cell
function buildKeyCell(id, primaryKey, sortKeys) {
    var keypress = '"updatePK(\'' + id + '\')"',
        css = "PK-context-menu tab",
        cellValue = buildButtonHtml(id);

    let retVal = '<div id="' + id + '" class="tabable ' + css + ' tab' + tabIndex + '" tabindex="0" onfocus="$(\'' + id + '\').selectText(' + tabIndex++ + ')" onfocusout="focusOut(\'' + id + '\')" onkeypress=' + keypress + ' contenteditable>' + cellValue +'</div>';

    return retVal;
}

// construct the button HTML for a key cell
function buildButtonHtml(id) {
    var add = '<input tabindex="-1" onclick="editDocument(\'' + id + '\')" type="image" src="./img/edit.png" title="Edit Document" style="cursor:pointer; background:transparent; float:right; border:0; outline:none;" border = 0 width="15" height="15">',
        remove = '"deletePartition(\'' + id + '\')"',
        text = cellId[id].PK,
        title = "Delete Document";

    text += '<div tabindex="-1" style="min-width: 35px;" class="bottomright noselect">' + add + '<input tabindex="-1" onclick=' + remove + ' type="image" src="./img/delete.png" title="' + title + '" style="cursor:pointer; background:transparent; float:left; border:0; outline:none;" border = 0 width="15" height="15"></div>'
    
    return text;
}

// process value templates and generate values
function expandValueTemplates() {
    for (let item of datamodel.TableData) {
        for (let [name, value] of Object.entries(item)) {
            if (!item.type) continue
            let type = Object.values(item.type)[0]
            if (type == '~new~') continue

            let entity = schema.models[type]
            if (!entity) continue

            let field = entity[name]
            if (!field || !field.value) continue

            let text = field.value.replace(/\${(.*?)}/g, (pattern, varName) => {
                return item[varName] ? Object.values(item[varName])[0] : pattern
            })
            if (text != value) {
                item[name] = { 'S' : text }
            }
        }
    }
}

// choose a table to view from the model
function selectTable() {
    $("#selectTableDiv").show();
}

function getCookie(cname) {
  var name = cname + "=";
  var decodedCookie = decodeURIComponent(document.cookie);
  var ca = decodedCookie.split(';');
  for(var i = 0; i < ca.length; i++) {
    var c = ca[i];
    while (c.charAt(0) == ' ') {
      c = c.substring(1);
    }
    if (c.indexOf(name) == 0) {
      return c.substring(name.length, c.length);
    }
  }
  return "";
}

function setCookie(cname,cvalue,exdays) {
  var d = new Date();
  d.setTime(d.getTime() + (exdays*24*60*60*1000));
  var expires = "expires=" + d.toGMTString();
  document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
}

// parse the json file coming from the file loader
function onReaderLoad(event) {
    if (alertData.caller == "loadModel") {
        model = JSON.parse(event.target.result);

        // Clear out prior schema
        schema = Object.assign({}, DefaultSchema)

        findDataModels();

        if (model.hasOwnProperty("ModelSchema")) {
            model.DataModel[modelIndex].ModelSchema = model.ModelSchema;
            delete model.ModelSchema;
        }
        
        loadDataModel();
    } else {
        credentials = JSON.parse(event.target.result);
        
        initDynamoClient();
        
        if ($("#saveCookie").is(":checked"))
            setCookie("credentials", JSON.stringify(credentials), 365);
    }
    
    $("#importFile").val("");
    alertData = {};
}

function initDynamoClient() {
    AWS.config.update(credentials);
    dynamodb = new AWS.DynamoDB();
    client = new AWS.DynamoDB.DocumentClient({maxRetries: 20, httpOptions: {connectTimeout: 500}});
    
    var params = {};
    
    dynamodb.listTables(params, function(err, data) {
        if (err) 
            console.log(err, err.stack);
        else {
            accountTables = data;
            
            // initialize the dropdown
            $("#acctTable").empty();
            // add the default selected item
            $("#acctTable").append('<option disabled="disabled" selected="selected" value="none"> -- none -- </option>');
            
            $.each(data.TableNames, function(idx, table) {
                $("#acctTable").append(`<option value="${table}">${table}</option>`);
            });
            
            $("#loadFromTable").show();
            $("#saveToTable").show();
            $("#loadCreds").hide();
        }
    });
}

function describeTable(params) { 
    dynamodb.describeTable(params, function (err, data) {
        if (err) 
            console.log(err, err.stack); // an error occurred
        else {
            $.each(data.Table.KeySchema, function (idx, key) {
                if (key.KeyType == "HASH") {
                    alertData.PK = key.AttributeName;
                } else {
                    alertData.SK = key.AttributeName;
                }
            });
        }
    });    
}

function togglePKdiv() {
    $("#customPKDiv").toggle($("#customPK").is(":checked"));
}

function saveToTable() {
    var params = {
        TableName: saveTable
    };
    
    describeTable(params);

    let item = {};
    item[alertData.PK] = "_schema";
    item[alertData.SK] = model.ModelName;
    item.Schema = model;

    params.Item = item;

    client.put(params, function (err, data) {
        if (err) {
            if (err.message.includes("Missing the key"))
                saveToTable();
            else
                console.log(err);
        } else {
            alertData = {};
            $("#schemaTableDiv").hide();
        }
    });
}

function schemaTable() {
    initDynamoClient();
    if (alertData.caller == "save") {
        saveTable = $("#acctTable").val();
        saveToTable();
    }
    else
        loadFromTable();
}

function loadModels() {
    if (alertData.caller == "save")
        return;
    
    var params = {
        TableName: $("#acctTable").val()
    };

    describeTable(params);
    
    params = {
        TableName: $("#acctTable").val(),
        KeyConditionExpression: "#pk = :val",
        ExpressionAttributeNames: {
            "#pk": alertData.PK
        },
        ExpressionAttributeValues: {
            ":val": "_schema"
        }
    };
    
    alertData.models = {};
    
    client.query(params, function(err, data) {
        if (err) { 
            if (err.message.includes("ExpressionAttributeNames"))
                loadModels();
            else
                console.log(err);
        } else {
            // initialize the dropdown
            $("#selectModel").empty();
            // add the default selected item
            $("#selectModel").append('<option disabled="disabled" selected="selected" value="none"> -- none -- </option>');
            
            $.each(data.Items, function(idx, item) {
                $("#selectModel").append(`<option value="${item[alertData.SK]}">${item[alertData.SK]}</option>`);
                alertData.models[item[alertData.SK]] = item.Schema;
            });
            
            $("#modelDiv").show();
        }
    });
}

function loadFromTable() {
    model = alertData.models[$("#selectModel").val()];
    alertData = {};
    $("#modelDiv").hide();
    $("#schemaTableDiv").hide();
    loadDataModel();
}

function scanTable() {
    var params = {
        TableName: $("#acctTable").val()
    };  
    
    model = {
        "ModelName": "Hospital",
        "ModelMetadata": {
            "Author": "",
            "DateCreated": "Nov 24, 2020, 08:00 PM",
            "DateLastModified": "Apr 17, 2021, 01:07 PM",
            "Description": "",
            "AWSService": "Amazon DynamoDB",
            "Version": "2.0"
        },
        DataModel: [{
            TableName: $("#acctTable").val() 
        }]
    };
    
    dynamodb.describeTable(function(err, data) {
        
    });
    
    params.Limit = $("#txtItemCount").val();
    
    client.scan(params, onScan);
    //loadDataModel();
}

function onScan(err, data) {
    if (err) {
        console.error("Unable to scan the table. Error JSON:", JSON.stringify(err, null, 2));
    } else {
        
        data.Items.forEach(function(item) {
            alert(JSON.stringify(item));
            // TODO - load Items into tableData
        });
        
        if (typeof data.LastEvaluatedKey != "undefined") {
            params.ExclusiveStartKey = data.LastEvaluatedKey;
            docClient.scan(params, onScan);
        }
    }
}

// load the table data models into the view table dropdown
function findDataModels() {
    // initialize the dropdown
    $("#viewTable").empty();

    // add the default selected item
    $("#viewTable").append('<option disabled="disabled" selected="selected" value="none"> -- none -- </option>');

    // add an option for each table in the model
    $.each(model["DataModel"], function (idx, obj) {
        $("#viewTable").append(`<option value="${idx}">${obj.CollectionName}</option>`);
    });

    // add the create new table option
    $("#viewTable").append('<option value="-1"> Add new Collection... </option>');
}

// add a new table to the model 
function addCollection() {
    $("#tbSort").show();
    $("#dropSort").show();
    $("#primaryKey").hide();
    $("#projection_cfg").hide();
    $('#createCollection').toggle();
}

/*
    Create a schema from the data in a workbench model
 */
function createSchema() {
    schema = Object.assign({}, DefaultSchema)
    let {data, indexes, models, queries} = schema
    let keys = datamodel.KeyAttributes

    /*
        Extract indexes
     */
    indexes.primary = {
        hash: "_id"
    }
    for (let gsi of datamodel.GlobalSecondaryIndexes) {
        indexes[gsi.IndexName] = {
            hash: gsi.KeyAttributes.PartitionKey.AttributeName,
            sort: gsi.KeyAttributes.SortKey.AttributeName,
            projection: gsi.Projection.ProjectionType,
        }
    }

    /*
        Extract the schema entity models
     */
    for (let row of datamodel.TableData) {
        let entity
        if (row.type) {
            let type = Object.values(row.type)[0]
            entity = schema.models[type] = schema.models[type] || {}
        }
        /*
            Extract the attributes, map the types and save the data to the schema.data (future)
         */
        let drow = {}
        for (let [fieldName, col] of Object.entries(row)) {
            if (entity) {
                let field = entity[fieldName] = entity[fieldName] || {}
                field.type = dynamoToType(Object.keys(col)[0])
            }
            drow[fieldName] = Object.values(col)[0]
        }
        data.push(drow)
    }
    /*
        Apply the value templates
     */
    for (let [type, fn] of Object.entries(keys.PartitionKey.MapFunction || {})) {
        schema.models[type][keys.ParitionKey.AttributeName].value = fn
    }
    for (let [type, fn] of Object.entries(keys.SortKey.MapFunction || {})) {
        schema.models[type][keys.SortKey.AttributeName].value = fn
    }
    for (let att of datamodel.NonKeyAttributes) {
        for (let [type, fn] of Object.entries(att.MapFunction || {})) {
            schema.models[type][att.AttributeName].value = fn
        }
    }

    datamodel.ModelSchema = schema;
}

// load the current data model for the viewer
function loadDataModel() {
    datamodel = model.DataModel[modelIndex];
    
    // if (!datamodel.hasOwnProperty("ModelSchema"))
    //     createSchema();
    // else
    //     schema = datamodel.ModelSchema;
    
    table = {
        name: datamodel.CollectionName,
        primary_key: "_id"
    };

    if (!tableChanges.hasOwnProperty(datamodel.CollectionName))
        tableChanges[datamodel.CollectionName] = [];

    //expandValueTemplates();
    json_data = datamodel.CollectionData;

    if (match_data.length > 0)
        json_data = match_data;

    // render the table
    showTable();
}

// download the model in JSON format
function saveModel() {
    if (!model.hasOwnProperty("ModelName")) {
        var date = new Date();

        model.ModelName = "export";
        model.ModelMetadata  = {
            "Author": "unknown",
            "DateCreated": date.toDateString(),
            "DateLastModified": date.toDateString(),
            "Description": ""
        };
    }

    save(JSON.stringify(model), model.ModelName + ".json", "json");
}

// save the file
function save(data, filename, type) {
    var file = new Blob([data], {type: type});
    if (window.navigator.msSaveOrOpenBlob) // IE10+
        window.navigator.msSaveOrOpenBlob(file, filename);
    else { // Others
        var a = document.createElement("a"),
                url = URL.createObjectURL(file);
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(function() {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 0);
    }
}

// store a copy of the current datamodel in the history buffer
function makeChange() {
    //MOB - must save schema here somehow
    tableChanges[model.DataModel[modelIndex]["CollectionName"]].push(JSON.parse(JSON.stringify(datamodel)));

    // if the buffer is too long then trim the oldest change
    if (tableChanges[model.DataModel[modelIndex]["CollectionName"]].length > 50)
        tableChanges[model.DataModel[modelIndex]["CollectionName"]].shift();
}

// undo the last edit to the model
function undoChange() {
    // if there are changes then undo the last one
    if (tableChanges[model.DataModel[modelIndex]["CollectionName"]].length > 0) {
        // pop the last change into the current datamodel and reset the config
        model.DataModel[modelIndex] = tableChanges[model.DataModel[modelIndex]["CollectionName"]].pop();
    }

    selectId = boundary.first;
    loadDataModel();
}

// scan object templates and add new types
function addEntityToSchema(obj) {
    var type = obj.type;
    if (type != '~new~' && !schema.models[type]) {
        // add the type template object
        schema.models[type] = {type: { type: 'String', required: true, value: type }};

        // add all the attributes from this object to the template
        $.each(Object.keys(obj), function (idx, key) {
            schema.models[type][key] = { type: 'String' };
        });
    }
}

// group objects by current partion key, sorted by current sort key
function sortObjectList(isCollection, key, jsonData) {
    var sortedItems = []
        newArr = [],
        lastValue = "";

    jsonData.forEach(function (document) {
        if (document.dispVals[key].localeCompare(lastValue) != 0 && newArr.length > 0) {
            sortedItems.push(newArr);
            newArr = [];
        }
        lastValue = document.dispVals[key];
        newArr.push(document);
    });

    sortedItems.push(newArr);
    return sortedItems;
}

// select the text inside the focused table element
jQuery.fn.selectText = function(idx){
    var doc = document;
    var element = $("#cell" + idx)[0];
    idx++;

    if ( !cellId.hasOwnProperty("cell" + idx) )
        idx--;
    
    selectId = cellId["cell" + idx];

    mouseDown = false;
    console.log(this, element);
    if (doc.body.createTextRange) {
        var range = document.body.createTextRange();
        range.moveToElementText(element);
        range.select();
    } else if (window.getSelection) {
        var selection = window.getSelection();
        var range = document.createRange();
        range.selectNodeContents(element);
        range.setEnd(element, 1);
        selection.removeAllRanges();
        selection.addRange(range);
    }
    
    buildContextMenus();
};

// create a fake UUID
function fakeUUID() {
   return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
   });
}

// onclick event for Question dialog
function postResponse(applyAll) {
    $(".modal").hide();

    var new_data = [];

    switch (alertData.caller) {
        case "saveDocument":

            if (applyAll) {
                alertData.data.deletedAttrs.forEach(function (attr) {
                    delete schema.models[alertData.data.type][attr];

                    json_data.forEach(function (doc, index) {
                        if (doc.type.localeCompare(alertData.type)) {
                            delete doc[attr];
                        }
                    });
                });

                alertData.data.newAttrs.forEach(function (attr) {
                    schema.models[alertData.data.type][attr] = { type: 'String' };

                    json_data.forEach(function (document) {
                        if (document["type"].localeCompare(alertData.data.type) == 0 && document["_id"].localeCompare(alertData.data.callerId) != 0) {
                            document[attr] = "~new~";
                        }
                    });
                })
           }

            loadDataModel();
            break;

        case "createModel":
            if (response == '0')
                $("#createModelDiv").show();
            break;

        case "deletePartition":
            $.each(json_data, function (idx, obj) {
                if (obj["_id"] != alertData.data)
                    new_data.push(obj);
            });
            break;

        case "cutItem":
        case "copyItem":
        case "deleteItem":
            var PK = cellId[alertData.data].obj[table.primary_key];

            $.each(json_data, function (idx, obj) {
                if (obj[table.primary_key] == PK)
                    pasteItem = obj;
                else
                    new_data.push(obj);
            });
            break;

        default:
            alertData = "";
            break;
    }

    if (alertData.caller.startsWith("delete") || alertData.caller.startsWith("cut")) {
        showValues = true;
        makeChange();
        model.DataModel[modelIndex].CollectionData = new_data;
        loadDataModel();
        pasteItem = alertData.caller == "cutItem" ? pasteItem : {};
    }
}

// delete an attribute from an entity type
function removeAttr(applyAll) {
    var PK = selectId.PK,
        SK = selectId.SK,
        attr = selectId.attr,
        type = "";

    makeChange();
    $.each(json_data, function(idx, obj) {
        if (obj[table.primary_key] == PK) {
            delete obj[attr];
            type = obj.type;
            return false;
        }
    });

    if (applyAll) {
        $.each(json_data, function(idx, obj) {
            if (obj["type"] == type)
            delete obj[attr];
        });
        if (schema.models[type]) {
            delete schema.models[type][attr];
        }
    }

    selectId.attr = table.sort_key;
    $("#removeAttributeModal").hide();
    loadDataModel();
}

// create a mapping for an entity attribute
function createMapping(type, name, value) {
    schema.models[type][name].value = value

    /*
    makeChange();
    switch (alertData.caller) {
        case table.primary_key:
            if (!datamodel.KeyAttributes.PartitionKey.hasOwnProperty("MapFunction"))
                datamodel.KeyAttributes.PartitionKey.MapFunction = {};

            datamodel.KeyAttributes.PartitionKey.MapFunction[alertData.data.type] = alertData.data.function;
            break;

        case table.sort_key:
            if (!datamodel.KeyAttributes.SortKey.hasOwnProperty("MapFunction"))
                datamodel.KeyAttributes.SortKey.MapFunction = {};

            datamodel.KeyAttributes.SortKey.MapFunction[alertData.data.type] = alertData.data.function;
            break;

        default:
            $.each(datamodel.NonKeyAttributes, function (idx, attr) {
                if (attr.AttributeName == alertData.caller) {
                    if (!attr.hasOwnProperty("MapFunction"))
                        attr.MapFunction = {};
                    attr.MapFunction[alertData.data.type] = alertData.data.function;
                }
            });
            break;
    }
    if (loadModel) {
        loadDataModel();
    }
    */
}

// get the backing Item for a table cell by cellId
function findItemByCellId(id) {
    var item = null;
    $.each(json_data, function(idx, obj) {
        if (obj[table.primary_key] == cellId[id].PK && obj[table.sort_key] == cellId[id].SK) {
            item = obj;
            return false;
        }
    });

    return item;
}

// update the entity type in the Mapping Function modal when it is changed
function setType() {
    if (datamodel.KeyAttributes.PartitionKey.hasOwnProperty("MapFunction"))
        if (datamodel.KeyAttributes.PartitionKey.MapFunction.hasOwnProperty($("#selectType").val()))
            $("#txtMapFunction").val(datamodel.KeyAttributes.PartitionKey.MapFunction[$("#selectType").val()]);

    $("#txtMapFunction").prop("disabled", false);
    $("#btnDefineMap").prop("disabled", false);
    alertData.data.type = $("#selectType").val();
    $("#lblEditMap").text("Enter Mapping Function for '" + alertData.data.type + "." + alertData.caller + "' attribute:");
    $("#txtMapFunction").focus();
}

// initialize and show the Value Template modal
function showValueTemplate(id) {
    alertData.data = {};
    alertData.caller = cellId[id].attr;

    $('#selectType')
    .find('option')
    .remove()
    .end()
    .append('<option selected="true" disabled="disabled">--Select a Type--</option>');

    if (alertData.caller == table.primary_key) {
        $("#txtMapFunction").prop("disabled", true);
        $("#btnDefineMap").prop("disabled", true);

        $.each(schema.models, function(prop, val) {
            $("#selectType").append($('<option></option>').val(prop).html(prop));
        });
        $("#selectTypeDiv").show();
    } else {
        var item = findItemByCellId(id);
        alertData.data.type = item.type;
        $("#lblEditMap").text("Enter Mapping Function for '" + alertData.data.type + "." + alertData.caller + "' attribute:");
    }

    switch (alertData.caller) {
        case table.sort_key:
            if (datamodel.KeyAttributes.SortKey.hasOwnProperty("MapFunction"))
                if (datamodel.KeyAttributes.SortKey.MapFunction.hasOwnProperty(alertData.data.type))
                    $("#txtMapFunction").val(datamodel.KeyAttributes.SortKey.MapFunction[alertData.data.type]);
            break;

        default:
            $.each(datamodel.NonKeyAttributes, function(idx, obj) {
                if (obj.AttributeName == alertData.caller && obj.hasOwnProperty("MapFunction"))
                    if (obj.MapFunction.hasOwnProperty(alertData.data.type))
                        $("#txtMapFunction").val(obj.MapFunction[alertData.data.type]);
            });
            break;
    }

    $("#defineValueTemplateDiv").show();
    $("#txtMapFunction").focus();
}

// construct the context menus for the table cells
function buildContextMenus() {
    $.contextMenu( 'destroy' );
    var items = {};
    
    $.each(datamodel.NonKeyAttributes, function(idx, attr) {
        if (!selectId.obj.hasOwnProperty(attr.AttributeName))
            items[attr.AttributeName] = {name: attr.AttributeName};
    })
    
    if (Object.keys(items).length > 0)
        $.contextMenu({
            selector: '.attribute-context-menu',
            callback: function(key, options) {
                selectId.attrName = key;
                nameAttribute($(this).attr("id"));
            },
            items: items
        });
    
    items["new"] = {name: "New attribute..."};

    items = {
        "add": {
            name: "Add Attribute", 
            icon: "fa-plus",
            items: items
        },
        "cut": {name: "Cut Item", icon: "fa-cut"},
        "copy": {name: "Copy Item", icon: "fa-copy"},
        "delete": {name: "Delete Item", icon: "fa-minus"},
        "function": {
            name: "Edit Value Template",
            icon: "fa-wrench"
        },
        "insert": {
            name: "Generate Value",
            items: {
                "uuid": { name: "UUID", icon: "fa-fingerprint" },
                "date": { name: "ISO8601 Date String", icon: "fa-clock" }
            },
            icon: "fa-clone"
        }
    };

    $.contextMenu({
        selector: '.SK-context-menu',
        callback: function(key, options) {
            switch (key) {
                case "date":
                    $(this).text(new Date().toISOString().split(".")[0]);
                    selectId.SK = $(this).text();
                    setValue($(this).attr("id"));
                    break;

                case "uuid":
                    $(this).text(fakeUUID());
                    selectId.SK = $(this).text();
                    setValue($(this).attr("id"));
                    break;

                case "cut":
                    alertData.caller = "cutItem";
                    alertData.data = $(this).attr("id");
                    postResponse();
                    break;

                case "copy":
                    alertData.caller = "copyItem";
                    alertData.data = $(this).attr("id");
                    postResponse();
                    break;

                case "delete":
                    deleteItem($(this).attr("id"));
                    break;

                case "function":
                    showValueTemplate($(this).attr("id"));
                    break;
                    
                default:
                    addAttribute($(this).attr("id"), key == "new" ? "~new~" : key);
                    break;
            }
        },
        items: items
    });
    
    $.contextMenu({
        selector: '.cell-context-menu',
        callback: function(key, options) {
            switch (key) {
                case "date":
                    $(this).text(new Date().toISOString().split(".")[0]);
                    setValue($(this).attr("id"));
                    break;

                case "uuid":
                    $(this).text(fakeUUID());
                    setValue($(this).attr("id"));
                    break;

                case "delete":
                    selectId = cellId[$(this).attr("id")];
                    $("#removeAttributeModal").show();
                    break;

                case "function":
                    showValueTemplate($(this).attr("id"));
                    break;
            }
        },
        items: {
            "delete": {
                name: "Delete Attribute",
                icon: "fa-minus",
                disabled: function(key, opt) {
                    return cellId[$(this).attr("id")].attr == "type";
                }
            },
            "function": {
                name: "Edit Value Template",
                icon: "fa-wrench",
                disabled: function(key, opt) {
                    return cellId[$(this).attr("id")].attr == "type";
                }
            },
            "insert": {
                name: "Generate Value",
                items: {
                    "uuid": { name: "UUID", icon: "fa-fingerprint" },
                    "date": { name: "ISO8601 Date String", icon: "fa-clock" }
                },
                icon: "fa-clone"
            }
        }
    });

    items = {
        "add": {name: "Add Attribute", icon: "fa-plus"},
        // "paste": {
        //     name: "Paste Item",
        //     icon: "fa-paste",
        //     disabled: function(key, opt) {
        //         return Object.keys(pasteItem).length == 0;
        //     }
        // },
        "delete": {name: "Delete Document", icon: "fa-minus"},
        // "function": {
        //     name: "Edit Value Template",
        //     icon: "fa-wrench"
        // }
    };

    $.contextMenu({
        selector: '.PK-context-menu',
        callback: function(key, options) {
            switch (key) {
                case "add":
                    addAttribute($(this).attr("id"), "~new~");
                    break;

                case "delete":
                    deletePartition($(this).attr("id"));
                    break;

                case "paste":
                    selectId.SK = pasteItem.SK;
                    selectId.attr = table.sort_key;
                    addItem($(this).attr("id"));
                    loadDataModel();
                    break;

                case "moveUp":
                case "moveDown":
                    selectId = cellId[$(this).attr("id")];
                    movePartition(key == "moveUp");
                    break;

                case "function":
                    showValueTemplate($(this).attr("id"));
                    break;
            }
        },
        items: items
    });

    items = {
        "add": {
            name: "Add Attribute", 
            icon: "fa-plus"
        },
        "cut": {name: "Cut Item", icon: "fa-cut"},
        "copy": {name: "Copy Item", icon: "fa-copy"},
        "delete": {name: "Delete Item", icon: "fa-minus"},
        "function": {
            name: "Edit Value Template",
            icon: "fa-wrench"
        },
        "insert": {
            name: "Generate Value",
            items: {
                "uuid": { name: "UUID", icon: "fa-fingerprint" },
                "date": { name: "ISO8601 Date String", icon: "fa-clock" }
            },
            icon: "fa-clone"
        }
    };

    $.contextMenu({
        selector: '.SK-context-menu',
        callback: function(key, options) {
            switch (key) {
                case "date":
                    $(this).text(new Date().toISOString().split(".")[0]);
                    selectId.SK = $(this).text();
                    setValue($(this).attr("id"));
                    break;

                case "uuid":
                    $(this).text(fakeUUID());
                    selectId.SK = $(this).text();
                    setValue($(this).attr("id"));
                    break;

                case "cut":
                    alertData.caller = "cutItem";
                    alertData.data = $(this).attr("id");
                    postResponse();
                    break;

                case "copy":
                    alertData.caller = "copyItem";
                    alertData.data = $(this).attr("id");
                    postResponse();
                    break;

                case "delete":
                    deleteItem($(this).attr("id"));
                    break;

                case "function":
                    showValueTemplate($(this).attr("id"));
                    break;
            }
        },
        items: items
    });
}

function toggleSchema() {
    showValues = !showValues
    showTable();
}

function getModel(type) {
    return schema.models.find(m => m.type == type)
}

function dynamoToType(dtype) {
    switch (dtype) {
    case 'B':
        return 'Binary'
    case 'BOOL':
        return 'Boolean'
    case 'S':
        return 'String'
    case 'N':
        return 'Number'
    case 'SS':
        return 'Set'
    default:
        return 'String'
    }
}

function typeToDynamo(type) {
    switch (type) {
    case 'Binary':
        return 'B'
    case 'Boolean':
        return 'BOOL'
    case 'Date':
        return 'S'
    case 'Number':
        return 'N'
    case 'Set':
        //  need support for SS, NS, BS
        return 'SS'
    default:
        return 'S'
    }
}


// Just for debug
dump = (...args) => {
    let s = []
    for (let item of args) {
        s.push(JSON.stringify(item, function (key, value) {
            if (this[key] instanceof Date) {
                return this[key].toLocaleString()
            }
            return value
        }, 4))
    }
    print(s.join(' '))
}
print = (...args) => {
    console.log(...args)
}

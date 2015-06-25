var recorder,context, play_context;
var usedFunctions = [], tmpFunctions = [], command_list = {}, fonts_arr = [];
var test_canvas, test_context, final_canvas, final_context;
var player = new Player();
var count_save = 0;
var count_restore = 0;


var stop_command = 0, current_command = 0;

function ProxyFunction(fn){
    var ifn = fn;
    //console.log(ifn);

    return function () {
        var args = [];
        for (var i=0;i<arguments.length;i++) {
            args.push(arguments[i]);
        }
        current_command++;
        if (ifn == 'drawImage') {
            if ((stop_command > 0) && (current_command > stop_command)) return false;
            context[ifn].apply(context, arguments);
            usedFunctions.push({name: ifn, type: 'function', args: args});
            //convert image to base64 and replace src
            new SaveImage(arguments,usedFunctions.length-1);
        }
        else {
            if ((stop_command > 0) && (current_command > stop_command)) return false;
            var res = context[ifn].apply(context, arguments);
            usedFunctions.push({name: ifn, type: 'function', args: args});
            return res;
        }
    }
}

function ProxyObject(obj,fn){
    var ifn = fn;

    obj.__defineGetter__(ifn, function() {
        current_command++;
        if ((stop_command > 0) && (current_command > stop_command)) return false;
        var res = context[ifn]
        //usedFunctions.push({name: ifn, dir: 'get', type: 'obj', args: arguments});
        return res;
    });

    obj.__defineSetter__(ifn, function(val) {
        current_command++;
        if ((stop_command > 0) && (current_command > stop_command)) return false;
        usedFunctions.push({name: ifn, type: 'object', args: arguments});
        context[ifn] = val;
    });
}

function ProxyOrdinar(obj,fn, type){
    var ifn = fn;
    var ord_type = type;
    Object.defineProperty(obj, ifn, {
        get: function() {
            current_command++;
            if ((stop_command > 0) && (current_command > stop_command)) return false;
            var res = context[ifn];
            //usedFunctions.push({name: ifn, type: ord_type, args: arguments});
            return res;
        },
        set: function(val) {
            current_command++;
            if ((stop_command > 0) && (current_command > stop_command)) return false;
            usedFunctions.push({name: ifn, type: ord_type, args: arguments});
            return context[ifn] = val;
        }
    });
}

function RecorderExtension(ctx){
    for (var prop in ctx) {
        if (typeof ctx[prop] == 'function') {
            //console.log(prop);
            recorder[prop] = ProxyFunction(prop);
        }
        else {
            if ((typeof ctx[prop] == 'string') || (typeof ctx[prop] == 'number') || (typeof ctx[prop] == 'boolean')) {
                ProxyOrdinar(recorder, prop, typeof ctx[prop]);
            }
            else {
                if (typeof ctx[prop] == 'object') {
                    ProxyObject(recorder,prop);

                }
                else console.log(prop+' is '+typeof ctx[prop]);
            }
        }
    }
}

function Recorder(){
    this.page;
}

Recorder.prototype.getFonts = function(){
    for (var i=0;i<fonts_arr.length;i++){
        fonts_arr[i].data = window.btoa(bytesToString(new Uint8Array(fonts_arr[i].data)));
    }
    //console.log(fonts_arr);
}


Recorder.prototype.savePage = function(){
    $.ajax({
        url: "/",
        method: "POST",
        data: JSON.stringify({action:'save_page',data:{page:recorder.page, commands:usedFunctions, fonts:fonts_arr}}),
        contentType: "application/json",
        complete: function() {
            //called when complete
            console.log('process complete');
            console.log('phantom get out!!!');
        },

        success: function(json) {
            //console.log(json);
            var answer = JSON.parse(json);
            if (answer.res == 'ok') {

            }
            else alert(answer.error);
            console.log('process success');
        },

        error: function(msg) {
            console.log('process error:');
            console.log(msg);
        },
    });
}


//trim number to 4 digits after .
Recorder.prototype.trimNumber = function(numb){
    var num = numb;
    if (num.toString().indexOf('.') > -1) {
        if (num.toString().substr(num.toString().indexOf('.')+1) > 4)
            //console.log(num.toFixed(4));
        return num.toFixed(4);
    }
    return num;
}

Recorder.prototype.optimizeCommands = function(){
    var commads_list = ['setValue','font'];
    var idx, key, args;
    for(var i=0;i<usedFunctions.length;i++){
        if ((usedFunctions[i].type == 'string') || (usedFunctions[i].type == 'number') ||
            (usedFunctions[i].type == 'boolean') || (usedFunctions[i].type == 'object')) {//ordinar type replace with function
            if (usedFunctions[i].name == 'font') {
                idx = 1;
                usedFunctions[i].args[0] = usedFunctions[i].args[0].replace(/"/g, '()');//in font name replace '"' with '()'
            }
            else idx = 0;
        }
        else idx = commads_list.indexOf(usedFunctions[i].name);
        if (idx < 0) {//push new function name
            commads_list.push(usedFunctions[i].name);
            idx = commads_list.length-1;
        }
        args = [];
        for (key in usedFunctions[i].args) {
            if (typeof usedFunctions[i].args[key] == 'number') usedFunctions[i].args[key] = recorder.trimNumber(usedFunctions[i].args[key]);
            args.push(usedFunctions[i].args[key]);
        }
        if (args.length > 0) {
            if (idx == 0) usedFunctions[i] = [idx,args,usedFunctions[i].name];
            else usedFunctions[i] = [idx,args];
        }
        else usedFunctions[i] = [idx];
    }
    usedFunctions.splice(0,0,commads_list);
    //console.log(usedFunctions);
    //save page to DB
    recorder.savePage();
    //draw page on control canvas (front-end)
    setTimeout(player.play,1000);
}

//functions for images
function SaveImage(src,idx){
    var args = src;
    convertImgToBase64(src, function(base64Img,idx){
        usedFunctions[idx].args[0] = base64Img;
    },idx);
}

function DrawImage(command,ctx){
    var img = new Image();  // Создание нового объекта изображения
    img.onload = function(){
        command[1][0] = this;
        ctx['drawImage'].apply(ctx,command[1]);
        player.play();
    };
    img.src = command[1][0];
}

function convertImages(){
    for (var i=0;i<usedFunctions.length;i++) {
        if (usedFunctions[i].name == 'drawImage'){
            new SaveImage(usedFunctions[i].args[0],i);//convert image to base64
        }
    }
}

/**
 * convertImgToBase64
 * @param  {String}   url
 * @param  {Function} callback
 * @param  {String}   [outputFormat='image/png']
 * @author HaNdTriX
 * @example
 convertImgToBase64('http://goo.gl/AOxHAL', function(base64Img){
		console.log('IMAGE:',base64Img);
	})
 */

function convertImgToBase64(url, callback, idx, outputFormat){
    if (url[0] instanceof Image) {
        url = url[0].src;
        //console.log(url);
        var img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = function () {
            var cvs = document.createElement('canvas');
            var ctx = cvs.getContext('2d');
            cvs.height = this.height;
            cvs.width = this.width;
            ctx.drawImage(this, 0, 0);
            var dataURL = cvs.toDataURL(outputFormat || 'image/png');
            callback(dataURL,idx);
            cvs = null;
        };
        img.src = url;
    }
    else {
        var dataURL = url[0].toDataURL(outputFormat || 'image/png');
        callback(dataURL,idx);
    }
}

var play_current_command = 0;
var play_time;
var txt_commands = '';

function Player(){
    var self = this;
    this.functions = {};
    this.cmds = [];

    this.index = function(){
        //console.log(self.functions);
        for(var i=0;i<usedFunctions.length;i++){
            if (!(self.functions[usedFunctions[i].name])) self.functions[usedFunctions[i].name] = self.getNewIndex();
            usedFunctions[i].name = self.functions[usedFunctions[i].name];
            self.cmds.push(usedFunctions[i]);
        }
        command_list = {functions:self.functions,commands:self.cmds};
    }

    this.getNewIndex = function(){
        var max_idx = 0;
        for(var fn in this.functions)
            if (this.functions[fn] > max_idx) max_idx = this.functions[fn];
        return (max_idx+1);
    }

    this.getNameByIdx = function(idx){
        for(var fn in this.functions)
            if (this.functions[fn] == idx) return fn;
        console.log('Wrong function idx:'+idx);
        return '';
    }

    this.play = function(){
        play_context = final_context;

        if (play_current_command == 0) {
            console.log('Player started');
            play_time = Date.now();
            var commands = usedFunctions;
            var commands_names = commands[0];
            commands.splice(0,1);
            //console.log(commands_names);
            //console.log(commands);
            for (var i=0;i<commands.length;i++) {
                commands[i][0] = commands_names[commands[i][0]];
                //in font name replace '()' with '"'
                if (commands[i][0] == 'font') {
                    commands[i][1] = commands[i][1].toString().replace(/\(\)/g, '"');
                }
            }
            var test = JSON.stringify(commands);
            console.log('Commands length: ' + test.length);
        }
        else var commands = usedFunctions;


        var last_command = commands.length;

        while(play_current_command < last_command){
            play_current_command++;
            if (commands[play_current_command-1][0] == 'drawImage') {
                new DrawImage(commands[play_current_command-1],play_context);
                return false;
                break;
            }
            if ((commands[play_current_command-1][0] == 'setValue') || (commands[play_current_command-1][0] == 'font')) {
                if (commands[play_current_command-1][0] == 'font' )play_context[commands[play_current_command - 1][0]] = commands[play_current_command - 1][1];
                else play_context[commands[play_current_command - 1][2]] = commands[play_current_command - 1][1];
            }
            else {
                if (commands[play_current_command - 1][1]) {
                    play_context[commands[play_current_command - 1][0]].apply(play_context, commands[play_current_command - 1][1]);
                }
                else play_context[commands[play_current_command - 1][0]]();
            }
        }
        //console.log(txt_commands);
        console.log('Player finished after: '+(Date.now()-play_time)+'ms');
    }

}
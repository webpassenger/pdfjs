var canvas, context, player;
var f_name = 'mir_upakovki_2_(04.2015).pdf';

$(document).ready(function(){
    canvas = document.getElementById('the-canvas');
    context = canvas.getContext('2d');

    player = new Player();
    player.getPage(3,1.5);
});

var play_current_command = 0;
var play_time;
var pdf_fonts;

function Player(){
    var self = this;

    this.setFonts = function() {
        if (!document.fonts) {
            if ((typeof pdf_fonts !== 'undefined') && (pdf_fonts.length > 0)) {
                var styleElement = document.getElementById('PDFJS_FONT_STYLE_TAG');
                if (!styleElement) {
                    styleElement = document.createElement('style');
                    styleElement.id = 'PDFJS_FONT_STYLE_TAG';
                    document.documentElement.getElementsByTagName('head')[0].appendChild(styleElement);
                }

                for (var i = 0; i < pdf_fonts.length; i++) {
                    var url = ('url(data:font/opentype;base64,' + pdf_fonts[i].data + ');');
                    var rule = '@font-face { font-family:"' + pdf_fonts[i].loadedName + '";src:' + url + '}';
                    styleElement.appendChild(document.createTextNode(rule));
                }
            }
        }
        else {
            if ((typeof pdf_fonts !== 'undefined') && (pdf_fonts.length > 0)) {
                var raw, nativeFontFace;
                for (var i = 0; i < pdf_fonts.length; i++) {
                    raw = stringToBytes(window.atob(pdf_fonts[i].data));
                    nativeFontFace = new FontFace(pdf_fonts[i].loadedName, raw, {});
                    document.fonts.add(nativeFontFace);
                }
            }
        }
    }

    this.draw = function(data) {
        canvas.height = data.page.viewport.height;
        canvas.width = data.page.viewport.width;
        commands_list = data.commands;
        pdf_fonts = data.fonts;
        this.setFonts();
        this.play();
    }

    this.play = function() {

        play_context = context;

        if (play_current_command == 0) play_time = Date.now();

        var commands = commands_list;

        while(play_current_command < commands.length){
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
        console.log('Player finished after: '+(Date.now()-play_time)+'ms');
    }

    this.getPage = function(number,scale){
        //if ((socket.live) && (socket.live == true)) {
        //    socket.send(JSON.stringify({action:'get_page',data:{number:number, scale:scale}}));
        //}
        $.ajax({
            url: "/",
            method: "POST",
            data: JSON.stringify({action:'get_page',data:{f_name: f_name, num_page:number, scale:scale}}),
            contentType: "application/json",
            complete: function() {
                //called when complete
                console.log('process complete');
            },

            success: function(json) {
                var answer = JSON.parse(json);
                if (answer.res == 'ok') {
                    answer = JSON.parse(answer.data);
                    //commands reconstruction
                    var commands = answer.commands[0];
                    answer.commands.splice(0,1);
                    for (var i=0;i<answer.commands.length;i++) {
                        answer.commands[i][0] = commands[answer.commands[i][0]];
                        //in font name replace '()' with '"'
                        if (answer.commands[i][0] == 'font') {
                            answer.commands[i][1] = answer.commands[i][1].toString().replace(/\(\)/g, '"');
                        }
                    }
                    player.draw(answer);
                }
                else alert(answer.error);
                console.log('process sucess');
            },

            error: function(msg) {
                console.log('process error:');
                console.log(msg);
            },
        });
    }
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

function stringToBytes(str) {
    var length = str.length;
    var bytes = new Uint8Array(length);
    for (var i = 0; i < length; ++i) {
        bytes[i] = str.charCodeAt(i) & 0xFF;
    }
    return bytes;
}
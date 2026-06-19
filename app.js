let currentData = null;
const canvas = document.getElementById("timelineCanvas");
const ctx = canvas.getContext("2d");

document
.getElementById("jsonFile")
.addEventListener("change", loadJson);

document
.getElementById("downloadPdf")
.addEventListener("click", downloadPDF);

function loadJson(event){


const file = event.target.files[0];

if(!file){
    return;
}

const reader = new FileReader();

reader.onload = async function(e){

    const data = JSON.parse(e.target.result);

    const errors =
        validateData(data);
    
    if(errors.length){
    
        alert(
            errors.join("\n\n")
        );
    
        return;
    }

    try{

        const result =
            await sendToSpreadsheet(data);

        currentData = result;

        drawTable(result);

        document.getElementById("downloadPdf").disabled = false;

    }catch(error){

        console.error(error);
        alert("Googleスプレッドシートとの通信に失敗しました。");

    }

};

reader.readAsText(file);


}

function formatDuration(minutes){


const h = Math.floor(minutes / 60);
const m = minutes % 60;

if(h === 0){
    return `${m}m`;
}

if(m === 0){
    return `${h}h`;
}

return `${h}h${m}m`;

}

function formatMinutes(minutes){

    const sign = minutes < 0 ? "-" : "";

    minutes = Math.abs(minutes);

    const h = Math.floor(minutes / 60);
    const m = minutes % 60;

    return `${sign}${h}h${m}m`;
}

function timeToMinutes(timeStr){

const [h,m] = timeStr.split(":").map(Number);

return h * 60 + m;


}

const SUBJECT_COLORS = {
    "国語": "#e53935",
    "数学": "#1e88e5",
    "英語": "#8e24aa",
    "物理": "#43a047",
    "化学": "#fdd835",
    "地理": "#fb8c00"
};

const SUBJECT_LABELS = {
    "国語": "国",
    "数学": "数",
    "英語": "英",
    "物理": "物",
    "化学": "化",
    "地理": "地"
};

const MATERIAL_LABELS = {
    "システム英単語": "単語"
};

function shouldShowTimeLabel(timeStr){

    const minutes =
        Number(timeStr.split(":")[1]);

    return !(minutes === 0 || minutes === 30);
}

//JSON欠損チェック

function validateData(data){

    const errors = [];

    // 7日チェック

    if(
        !data.week ||
        data.week.length !== 7
    ){
        errors.push(
            "week は7日分必要です"
        );
    }

    const startMin =
        timeToMinutes(
            data.timeline.start
        );

    const endMin =
        timeToMinutes(
            data.timeline.end
        );

    data.week.forEach(day=>{

        const plans =
            [...day.plans];

        // 各計画

        plans.forEach(plan=>{

            const s =
                timeToMinutes(
                    plan.start
                );

            const e =
                timeToMinutes(
                    plan.end
                );

            // 終了<=開始

            if(e <= s){

                errors.push(
                    `${day.date} ${plan.subject}
終了時刻が開始時刻以前`
                );
            }

            // 時間軸外

            if(
                s < startMin ||
                e > endMin
            ){

                errors.push(
                    `${day.date} ${plan.subject}
時間軸外`
                );
            }

            // 科目

            if(
                !SUBJECT_COLORS[
                    plan.subject
                ]
            ){

                errors.push(
                    `${day.date}
不明な科目:
${plan.subject}`
                );
            }

        });

        // 重複チェック

        plans.sort((a,b)=>
            timeToMinutes(a.start)
            -
            timeToMinutes(b.start)
        );

        for(
            let i=0;
            i<plans.length-1;
            i++
        ){

            const currentEnd =
                timeToMinutes(
                    plans[i].end
                );

            const nextStart =
                timeToMinutes(
                    plans[i+1].start
                );

            if(
                currentEnd >
                nextStart
            ){

                errors.push(
                    `${day.date}
時間重複:
${plans[i].subject}
と
${plans[i+1].subject}`
                );
            }

        }

    });

    return errors;
}

function drawTable(
    data,
    scale = 1
){

ctx.save();

ctx.setTransform(scale,0,0,scale,0,0);

ctx.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
);

const W = canvas.width / scale;

const leftCol = 70;
const rightCol = 70;

const headerHeight = 30;

const rowHeight =
    100;

const bodyHeight =
    rowHeight * 7;

const timelineLeft = leftCol;
const timelineRight = W - rightCol;
const timelineWidth =
    timelineRight - timelineLeft;

const startMin =
    timeToMinutes(
        data.timeline.start
    );

const endMin =
    timeToMinutes(
        data.timeline.end
    );

const totalMin =
    endMin - startMin;

ctx.strokeStyle = "#000";
ctx.lineWidth = 1;

// 横線

for(let i=0;i<=7;i++){

    const y =
        headerHeight +
        i * rowHeight;

    ctx.beginPath();
    ctx.moveTo(0,y);
    ctx.lineTo(W,y);
    ctx.stroke();
}

// A列右

ctx.beginPath();
ctx.moveTo(leftCol,0);
ctx.lineTo(
    leftCol,
    headerHeight + bodyHeight
);
ctx.stroke();

// S列左

ctx.beginPath();
ctx.moveTo(W-rightCol,0);
ctx.lineTo(
    W-rightCol,
    headerHeight + bodyHeight
);
ctx.stroke();

// S列右

ctx.beginPath();
ctx.moveTo(W - 1, 0);
ctx.lineTo(
    W - 1,
    headerHeight + bodyHeight
);
ctx.stroke();

// 時間線

for(
    let m=startMin + 30;
    m<endMin;
    m+=30
){

    const ratio =
        (m-startMin)/totalMin;

    const x =
        timelineLeft +
        ratio * timelineWidth;

    if(m % 60 === 0){

        ctx.setLineDash([8,6]);
        ctx.strokeStyle="#000";

    }else{

        ctx.setLineDash([3,6]);
        ctx.strokeStyle="#999";
    }

    ctx.beginPath();
    ctx.moveTo(x,headerHeight);
    ctx.lineTo(
        x,
        headerHeight + bodyHeight
    );
    ctx.stroke();

    if(m % 60 === 0){

        const hh =
            Math.floor(m/60);

        ctx.fillStyle="#000";
        ctx.textAlign="center";
        ctx.textBaseline = "bottom";

        ctx.fillText(
            `${hh}:00`,
            x,
            headerHeight - 8
        );
    }
}

ctx.setLineDash([]);

// 合計

ctx.textAlign = "center";
ctx.textBaseline = "bottom";

ctx.fillText(
    "合計",
    W - rightCol / 2,
    headerHeight - 8
);

// 日付

const weekdays = [
    "日",
    "月",
    "火",
    "水",
    "木",
    "金",
    "土"
];

data.week.forEach(
    (day,index)=>{

    const y =
        headerHeight +
        rowHeight*index +
        rowHeight/2;

    const d =
        new Date(day.date);

    ctx.fillStyle="#000";

    ctx.fillText(
        `${d.getMonth()+1}/${d.getDate()}`,
        leftCol/2,
        y-10
    );

    ctx.fillText(
        weekdays[d.getDay()],
        leftCol/2,
        y+15
    );

    let total = 0;

    day.plans.forEach(plan=>{

        total +=
            timeToMinutes(plan.end)
            -
            timeToMinutes(plan.start);

    });

    ctx.fillText(
        formatDuration(total),
        W-rightCol/2,
        y+5
    );

});

// =====================
// 勉強ブロック描画
// =====================
const ARROW_SIZE = 10;
    
data.week.forEach((day,index)=>{

    const rowTop =
        headerHeight +
        rowHeight * index;

    const centerY =
        rowTop +
        rowHeight / 2;

    day.plans.forEach(plan=>{

        const start =
            timeToMinutes(plan.start);

        const end =
            timeToMinutes(plan.end);

        const x1 =
            timelineLeft +
            ((start - startMin) / totalMin)
            * timelineWidth;

        const x2 =
            timelineLeft +
            ((end - startMin) / totalMin)
            * timelineWidth;

        const color =
            SUBJECT_COLORS[plan.subject]
            || "#888";

        // 本体

        ctx.strokeStyle = color;
        ctx.lineWidth = 4;
        ctx.lineCap = "round";

        ctx.beginPath();
        ctx.moveTo(x1, centerY);
        ctx.lineTo(x2, centerY);
        ctx.stroke();

        // 左矢印

        ctx.beginPath();
        ctx.moveTo(x1 + ARROW_SIZE, centerY - ARROW_SIZE);
        ctx.lineTo(x1, centerY);
        ctx.lineTo(x1 + ARROW_SIZE, centerY + ARROW_SIZE);
        ctx.stroke();

        // 右矢印

        ctx.beginPath();
        ctx.moveTo(x2 - ARROW_SIZE, centerY - ARROW_SIZE);
        ctx.lineTo(x2, centerY);
        ctx.lineTo(x2 - ARROW_SIZE, centerY + ARROW_SIZE);
        ctx.stroke();

        // ラベル（教材名 or 教科名）

        const hasMaterial =
            plan.material &&
            plan.material !== "null";

        const label =
            hasMaterial
            ? (MATERIAL_LABELS[plan.material] || plan.material)
            : (SUBJECT_LABELS[plan.subject] || "?");

        ctx.fillStyle = color;
        ctx.font = "bold 18px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        ctx.fillText(
            label,
            (x1 + x2) / 2,
            centerY - 18
        );

        // 開始時刻

        if(shouldShowTimeLabel(plan.start)){
            const startMinute =
                plan.start.split(":")[1];
            
            ctx.fillStyle = "#000";
            ctx.font = "9px sans-serif";
            
            ctx.textBaseline = "bottom";
            
            ctx.fillText(
                startMinute,
                x1 + 5,
                centerY - 12
            );
        }

        // 終了時刻

        if(shouldShowTimeLabel(plan.end)){

            const endMinute =
                plan.end.split(":")[1];
            
            ctx.fillStyle = "#000";
            ctx.font = "9px sans-serif";
            
            ctx.textBaseline = "top";
            
            ctx.fillText(
                endMinute,
                x2 - 5,
                centerY + 12
            );
        }

    });

});

//統計データ（GASから受信済み）

const stats =
    data.stats.current;

console.log(stats);

console.log(
    "総勉強時間",
    formatMinutes(
        stats.totalMinutes
    )
);

const analysisTop =
    headerHeight + bodyHeight;

//円グラフ
    
const pieX = W * 0.10;
const pieY = analysisTop + 135;

const outerRadius = 110;
const innerRadius = 65;

let startAngle = -Math.PI / 2;

//多い順にソート
const sortedSubjects =
    Object.entries(
        stats.subjects
    )
    .sort(
        (a,b)=>
        b[1] - a[1]
    );

sortedSubjects.forEach(
    ([subject,minutes])=>{
        
    const ratio =
        minutes /
        stats.totalMinutes;

    const endAngle =
        startAngle +
        ratio *
        Math.PI * 2;

    ctx.beginPath();

    ctx.moveTo(
        pieX,
        pieY
    );

    ctx.arc(
        pieX,
        pieY,
        outerRadius,
        startAngle,
        endAngle
    );

    ctx.closePath();

    ctx.fillStyle =
        SUBJECT_COLORS[subject];

    ctx.fill();

    startAngle = endAngle;
});

//真ん中くり抜く
ctx.beginPath();

ctx.arc(
    pieX,
    pieY,
    innerRadius,
    0,
    Math.PI * 2
);

ctx.fillStyle = "#fff";

ctx.fill();
    
//真ん中に総勉強時間表示
const totalHours =
    Math.floor(
        stats.totalMinutes / 60
    );

const totalMins =
    stats.totalMinutes % 60;

ctx.fillStyle = "#000";

ctx.textAlign = "center";
ctx.textBaseline = "middle";

ctx.font =
    "bold 24px sans-serif";

ctx.fillText(
    `${totalHours}h`,
    pieX,
    pieY - 18
);

ctx.fillText(
    `${totalMins}m`,
    pieX,
    pieY + 18
);

// =====================
// 円グラフ凡例
// =====================

const legendX = pieX + 170;

const legendLineHeight = 30;

const legendStartY =
    pieY
    -
    (
        (sortedSubjects.length - 1)
        *
        legendLineHeight
    )
    / 2;

ctx.textAlign = "left";
ctx.textBaseline = "middle";

ctx.font =
    "16px sans-serif";

//前週比較タイトル
ctx.fillStyle="#000";
ctx.font="bold 18px sans-serif";
ctx.textAlign="left";

ctx.fillText(
    "前週比較",
    legendX + 250,
    legendStartY - 25
);

ctx.font = "16px sans-serif";

sortedSubjects.forEach(
    ([subject,minutes],i)=>{

    const y =
        legendStartY +
        i *
        legendLineHeight;

    const percent =
        Math.round(
            minutes
            /
            stats.totalMinutes
            *
            100
        );

    // 色丸

    ctx.beginPath();

    ctx.arc(
        legendX,
        y,
        7,
        0,
        Math.PI * 2
    );

    ctx.fillStyle =
        SUBJECT_COLORS[subject];

    ctx.fill();

    // テキスト

    ctx.fillStyle = "#000";

    ctx.fillText(
        `${subject} : ${percent}% (${formatMinutes(minutes)})`,
        legendX + 18,
        y
    );

    //前週比較科目別
    const previous =
        (data.stats.previous.subjects &&
        data.stats.previous.subjects[subject]) || 0;
    
    const diff =
        minutes - previous;
    
    const sign =
        diff >= 0 ? "+" : "";
    
    ctx.font="16px sans-serif";
    
    ctx.fillStyle =
        diff>=0
        ? "#2e7d32"
        : "#c62828";
    
    ctx.fillText(
        `${sign}${formatMinutes(diff)}`,
        legendX + 250,
        y
    );

});
const weekdayAverage =
    stats.weekdayAverage;

const weekendAverage =
    stats.weekendAverage;

const weekAverage =
    stats.weekAverage;

const previous =
    data.stats.previous;

const weekAverageDiff =
    weekAverage - previous.weekAverage;

const weekdayAverageDiff =
    weekdayAverage - previous.weekdayAverage;

const weekendAverageDiff =
    weekendAverage - previous.weekendAverage;

//統計の表示位置
const statX1 = W * 0.40;
const statX2 = W * 0.54;
const statX3 = W * 0.68;

ctx.fillStyle = "#000";

ctx.font =
    "bold 22px sans-serif";

ctx.fillText(
    "一週間平均",
    statX1,
    analysisTop + 110
);

ctx.fillText(
    "平日平均",
    statX2,
    analysisTop + 110
);

ctx.fillText(
    "土日平均",
    statX3,
    analysisTop + 110
);

ctx.fillStyle = "#000";
ctx.font =
    "bold 38px sans-serif";

ctx.fillText(
    formatMinutes(
        weekAverage
    ),
    statX1,
    analysisTop + 175
);

ctx.fillText(
    formatMinutes(
        weekdayAverage
    ),
    statX2,
    analysisTop + 175
);

ctx.fillText(
    formatMinutes(
        weekendAverage
    ),
    statX3,
    analysisTop + 175
);

//平均値の前週比較

function drawAverageDiff(diff, x, y){

    const sign =
        diff >= 0 ? "+" : "";

    ctx.fillStyle =
        diff >= 0
        ? "#2e7d32"
        : "#c62828";

    ctx.font = "16px sans-serif";
    ctx.textAlign = "center";

    ctx.fillText(
        `${sign}${formatMinutes(diff)}`,
        x,
        y
    );

}

drawAverageDiff(
    weekAverageDiff,
    statX1,
    analysisTop + 205
);

drawAverageDiff(
    weekdayAverageDiff,
    statX2,
    analysisTop + 205
);

drawAverageDiff(
    weekendAverageDiff,
    statX3,
    analysisTop + 205
);

ctx.fillStyle = "#000";
ctx.textAlign = "left";

// =====================
// AIメッセージ
// =====================

const messageX = W * 0.05;
const messageY = analysisTop + 250;

const messageWidth = W * 0.73;
const messageHeight = 180;


ctx.textAlign = "left";

ctx.font =
    "18px sans-serif";

ctx.fillStyle = "#333";

//折り返し関数
function drawWrappedText(
    text,
    x,
    y,
    maxWidth,
    lineHeight
){

    const chars = text.split("");

    let line = "";
    let currentY = y;

    chars.forEach(char=>{

        const testLine =
            line + char;

        if(
            ctx.measureText(
                testLine
            ).width
            > maxWidth
        ){

            ctx.fillText(
                line,
                x,
                currentY
            );

            line = char;

            currentY +=
                lineHeight;

        }else{

            line = testLine;
        }

    });

    if(line){

        ctx.fillText(
            line,
            x,
            currentY
        );
    }
}

drawWrappedText(
    data.message || "",
    messageX + 20,
    messageY + 10,
    messageWidth - 40,
    28
);
    
ctx.restore();
}

//GASに送信（POST一回でデータ受信）
async function sendToSpreadsheet(data){

    const response =
        await fetch(
            "https://script.google.com/macros/s/AKfycbxirIXwQ-4oRIbAjYZT3oDstcWaMXRRNNycl9mp_URMMSnIE5L6R6SZrzEPg5QVhkDR/exec",
            {
                method: "POST",
                body: JSON.stringify(data)
            }
        );

    return await response.json();

}

//PDFダウンロード処理
async function downloadPDF(){

    if(!currentData) return;

    const oldWidth = canvas.width;
    const oldHeight = canvas.height;

    const oldStyleWidth = canvas.style.width;
    const oldStyleHeight = canvas.style.height;

    // A4横300dpi
    canvas.width = 3508;
    canvas.height = 2480;

    canvas.style.width = oldWidth + "px";
    canvas.style.height = oldHeight + "px";

    const scale = canvas.width / oldWidth;

    drawTable(
        currentData,
        scale
    );

    const { jsPDF } = window.jspdf;

    const pdf = new jsPDF({
        orientation:"landscape",
        unit:"mm",
        format:"a4"
    });

    pdf.addImage(
        canvas.toDataURL("image/png",1),
        "PNG",
        0,
        0,
        297,
        210
    );

    const startDate =
        currentData.week[0].date;

    pdf.save(
        startDate.replaceAll("-","")
        + "_study_plan.pdf"
    );

    // 元へ戻す
    canvas.width = oldWidth;
    canvas.height = oldHeight;

    canvas.style.width = oldStyleWidth;
    canvas.style.height = oldStyleHeight;

    drawTable(
        currentData,
        1
    );
}

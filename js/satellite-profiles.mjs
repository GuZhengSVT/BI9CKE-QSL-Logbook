// Short factual operating notes, checked against the linked primary sources.
// These are operating arrangements, not a claim of live payload availability.
export const profiles={
  25544:{
    aliases:'International Space Station · 国际空间站 · ZARYA · RS0ISS · NA1SS',operator:'ARISS · 国际空间站业余无线电项目',
    zh:{intro:'国际空间站上的业余无线电项目，支持跨段中继、分组通信、航天员语音与活动期间的慢扫描电视。不同载荷的工作模式会随任务安排切换。',schedule:'航天员语音通联没有固定时刻；中继、APRS 与 SSTV 的实际安排以 ARISS 公告为准。',notes:'跨段 FM 中继：上行 145.990 MHz，CTCSS 67 Hz；下行 437.800 MHz。APRS 常用 145.825 MHz，1200 baud。'},
    en:{intro:'Amateur Radio on the International Space Station supports cross-band FM, packet radio, crew voice contacts and scheduled SSTV events. Payload modes change with mission operations.',schedule:'Crew voice contacts are unscheduled. Check ARISS announcements for repeater, APRS and SSTV availability.',notes:'FM repeater: 145.990 MHz uplink with 67 Hz CTCSS; 437.800 MHz downlink. VHF APRS uses 145.825 MHz at 1200 baud.'},
    sources:[['ARISS · Frequencies','https://www.ariss.org/contact-the-iss.html'],['ARISS · Current status','https://www.ariss.org/current-status-of-iss-stations.html']],checked:'2026-10-18'
  },
  27607:{
    aliases:'SO-50 · Saudi-OSCAR 50 · SaudiSat-1C',
    zh:{intro:'搭载 V/U 业余 FM 中继的沙特卫星，使用 2 米波段上行、70 厘米波段下行，是手持设备卫星通联的常见目标。',schedule:'中继按需启动、受供电条件限制。使用前需启动 10 分钟计时器：上行发送约 2 秒、带 74.4 Hz 亚音的载波；通联时改用 67 Hz 亚音。',notes:'上行 145.850 MHz / FM / CTCSS 67 Hz；下行 436.795 MHz / FM。'},
    en:{intro:'A Saudi satellite carrying a V/U amateur FM repeater, with a 2 m uplink and 70 cm downlink, commonly used for portable satellite contacts.',schedule:'On-demand operation, power permitting. Arm the 10-minute timer with a 2-second uplink carrier using a 74.4 Hz tone, then use 67 Hz for contacts.',notes:'145.850 MHz FM uplink with 67 Hz CTCSS; 436.795 MHz FM downlink.'},
    sources:[['AMSAT · SO-50','https://www.amsat.org/two-way-satellites/so-50-satellite-information/']],checked:'2026-10-18'
  }
};

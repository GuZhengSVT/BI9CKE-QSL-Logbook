'use strict';
const StationMap = {
  land: null,
  async render(config, records) {
    const svg=document.getElementById('station-map'),caption=document.getElementById('map-status');
    if(!svg||!caption)return;
    const {center,contacts,farthest}=QslGeo.coverage(config.station,records);
    const layer=svg.querySelector('#map-data');layer.innerHTML='';
    caption.textContent=I18N.t(!center?'mapNeedsStation':!farthest?'mapNoContacts':'mapCoverage',{
      call:farthest?.record.CALL||'',km:Math.round(farthest?.km||0).toLocaleString(),located:contacts.length,total:records.length
    });
    if(!center)return;
    try {
      if(!this.land) {
        const response=await fetch('assets/world-land-dots.json');
        if(!response.ok)throw new Error('Map asset unavailable');
        this.land=(await response.json()).points;
      }
      const project=point=>QslGeo.azimuthal(center,point);
      const earthRadius=164,maxDistance=Math.PI*6371.0088;
      svg.querySelector('#map-land').innerHTML=`<circle class="map-disc" cx="360" cy="180" r="${earthRadius}"/>`+this.land.map(([lon,lat])=>{
        const p=project({lat,lon});return `<circle class="land-dot" cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r=".85"/>`;
      }).join('');
      const circles=farthest&&farthest.km>0?[1/3,2/3,1].map(scale=>`<circle class="coverage-ring ${scale===1?'outer-ring':''}" cx="360" cy="180" r="${farthest.km/maxDistance*earthRadius*scale}"/>`).join(''):'';
      layer.innerHTML=circles+contacts.map(contact=>{
        const p=project(contact.position);
        return `<circle class="contact-point" cx="${p.x}" cy="${p.y}" r="${contact===farthest?3.2:2}"><title>${Utils.esc(contact.record.CALL)} · ${Math.round(contact.km).toLocaleString()} km</title></circle>`;
      }).join('')+`<g class="station-point"><circle cx="360" cy="180" r="10" class="station-glow"/><circle cx="360" cy="180" r="3.5"/><text x="374" y="170">${Utils.esc(config.call)}</text><title>${Utils.esc(config.call)} · ${Utils.esc(config.station?.grid||`${center.lat.toFixed(3)}, ${center.lon.toFixed(3)}`)}</title></g>`;
    }catch(error){console.warn('Coverage map unavailable:',error.message);caption.textContent=I18N.t('mapLoadFailed');}
  }
};

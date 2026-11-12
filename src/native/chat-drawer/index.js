Component({
  options: { multipleSlots: true, styleIsolation: 'shared', addGlobalClass: true },
  properties: {
    opened: { type: Boolean, value: false },
    enabled: { type: Boolean, value: true },
    travel: { type: Number, value: 260 }
  },
  data: { motion: { open: false, enabled: true, width: 260 } },
  observers: {
    'opened,enabled,travel': function (opened, enabled, travel) {
      this.setData({ motion: { open: opened, enabled: enabled, width: travel } });
    }
  },
  lifetimes: {
    ready: function () {
      this.setData({ motion: {
        open: this.properties.opened,
        enabled: this.properties.enabled,
        width: this.properties.travel
      } });
    }
  },
  methods: {
    gestureStart: function () { this.triggerEvent('gesturephase', { phase: 'start' }); },
    gestureEnd: function (detail) { this.triggerEvent('gesturephase', { phase: 'end', open: detail.open }); }
  }
});
